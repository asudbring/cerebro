#!/usr/bin/env python3
"""
dbsql.py — Run SQL against the Cerebro Supabase database.

Uses a pure-Python PostgreSQL protocol implementation (no libpq dependency)
because libpq has SCRAM-SHA-256 compatibility issues with Supabase's pooler.

Usage:
  python3 scripts/dbsql.py "SELECT count(*) FROM thoughts"
  python3 scripts/dbsql.py -f schemas/core/007-source-message-id.sql
  echo "SELECT 1" | python3 scripts/dbsql.py

Environment variables (or set in .env):
  SUPABASE_DB_PASSWORD  (required)
  SUPABASE_DB_HOST      (default: aws-0-us-west-2.pooler.supabase.com)
  SUPABASE_DB_PORT      (default: 5432)
  SUPABASE_DB_USER      (default: postgres.YOUR_PROJECT_REF)
  SUPABASE_DB_NAME      (default: postgres)
"""
import sys, os, struct, hashlib, hmac, base64, socket, ssl


# Auto-load .env from project root
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _val = _line.split("=", 1)
                os.environ.setdefault(_key.strip(), _val.strip())

HOST = os.environ.get("SUPABASE_DB_HOST", "aws-0-us-west-2.pooler.supabase.com")
PORT = int(os.environ.get("SUPABASE_DB_PORT", "5432"))
USER = os.environ.get("SUPABASE_DB_USER", "")
PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")
DBNAME = os.environ.get("SUPABASE_DB_NAME", "postgres")


def recv_msg(sock):
    header = b""
    while len(header) < 5:
        chunk = sock.recv(5 - len(header))
        if not chunk:
            return None, None
        header += chunk
    tag = chr(header[0])
    length = struct.unpack("!I", header[1:5])[0]
    body = b""
    while len(body) < length - 4:
        chunk = sock.recv(length - 4 - len(body))
        if not chunk:
            break
        body += chunk
    return tag, body


def connect():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    sock = socket.create_connection((HOST, PORT), timeout=30)
    # SSLRequest
    sock.sendall(struct.pack("!II", 8, 80877103))
    resp = sock.recv(1)
    if resp != b"S":
        raise Exception("Server rejected SSL")
    sock = ctx.wrap_socket(sock, server_hostname=HOST)

    # StartupMessage (protocol 3.0)
    params = f"user\x00{USER}\x00database\x00{DBNAME}\x00\x00".encode()
    startup = struct.pack("!I", len(params) + 8) + struct.pack("!HH", 3, 0) + params
    sock.sendall(startup)

    tag, body = recv_msg(sock)
    auth_type = struct.unpack("!I", body[:4])[0]

    if auth_type == 10:  # SCRAM-SHA-256
        client_nonce = base64.b64encode(os.urandom(18)).decode()
        cfm_bare = f"n=*,r={client_nonce}"
        cfm = f"n,,{cfm_bare}"

        # SASLInitialResponse
        mechanism = b"SCRAM-SHA-256\x00"
        cfm_bytes = cfm.encode()
        sasl_init = mechanism + struct.pack("!i", len(cfm_bytes)) + cfm_bytes
        sock.sendall(b"p" + struct.pack("!I", len(sasl_init) + 4) + sasl_init)

        tag, body = recv_msg(sock)
        server_first = body[4:].decode()
        parts = dict(item.split("=", 1) for item in server_first.split(","))
        server_nonce = parts["r"]
        salt = base64.b64decode(parts["s"])
        iterations = int(parts["i"])

        salted_password = hashlib.pbkdf2_hmac(
            "sha256", PASSWORD.encode(), salt, iterations
        )
        client_key = hmac.new(salted_password, b"Client Key", "sha256").digest()
        stored_key = hashlib.sha256(client_key).digest()
        cfm_without_proof = f"c=biws,r={server_nonce}"
        auth_message = f"{cfm_bare},{server_first},{cfm_without_proof}"
        client_signature = hmac.new(
            stored_key, auth_message.encode(), "sha256"
        ).digest()
        client_proof = bytes(a ^ b for a, b in zip(client_key, client_signature))
        client_final = (
            f"{cfm_without_proof},p={base64.b64encode(client_proof).decode()}"
        )
        cf_bytes = client_final.encode()
        sock.sendall(b"p" + struct.pack("!I", len(cf_bytes) + 4) + cf_bytes)

        tag, body = recv_msg(sock)  # ServerFinal (R type=12)
        tag, body = recv_msg(sock)  # AuthenticationOk (R type=0)
    elif auth_type == 0:
        pass  # No auth required
    else:
        raise Exception(f"Unsupported auth type: {auth_type}")

    # Read until ReadyForQuery
    while True:
        tag, body = recv_msg(sock)
        if tag == "Z":
            break
        if tag == "E":
            raise Exception(
                f"Server error: {body.decode('utf-8', errors='replace')}"
            )
    return sock


def execute(sock, sql):
    query = sql.encode() + b"\x00"
    sock.sendall(b"Q" + struct.pack("!I", len(query) + 4) + query)

    columns = []
    rows = []
    command_tag = None
    has_error = False

    while True:
        tag, body = recv_msg(sock)
        if tag is None:
            break
        if tag == "T":  # RowDescription
            ncols = struct.unpack("!H", body[:2])[0]
            offset = 2
            columns = []
            for _ in range(ncols):
                end = body.index(b"\x00", offset)
                columns.append(body[offset:end].decode())
                offset = end + 1 + 18
        elif tag == "D":  # DataRow
            ncols = struct.unpack("!H", body[:2])[0]
            offset = 2
            row = []
            for _ in range(ncols):
                clen = struct.unpack("!i", body[offset : offset + 4])[0]
                offset += 4
                if clen < 0:
                    row.append(None)
                else:
                    row.append(
                        body[offset : offset + clen].decode("utf-8", errors="replace")
                    )
                    offset += clen
            rows.append(row)
        elif tag == "C":  # CommandComplete
            command_tag = body[:-1].decode()
        elif tag == "E":  # ErrorResponse
            fields = {}
            i = 0
            while i < len(body):
                if body[i] == 0:
                    break
                field_type = chr(body[i])
                i += 1
                end = body.index(b"\x00", i)
                fields[field_type] = body[i:end].decode("utf-8", errors="replace")
                i = end + 1
            severity = fields.get("S", "ERROR")
            message = fields.get("M", "Unknown error")
            detail = fields.get("D", "")
            hint = fields.get("H", "")
            err_msg = f"{severity}: {message}"
            if detail:
                err_msg += f"\nDETAIL: {detail}"
            if hint:
                err_msg += f"\nHINT: {hint}"
            print(err_msg, file=sys.stderr)
            has_error = True
        elif tag == "Z":  # ReadyForQuery
            break

    return columns, rows, command_tag, has_error


def main():
    if not PASSWORD:
        print("Error: SUPABASE_DB_PASSWORD not set", file=sys.stderr)
        print("  export SUPABASE_DB_PASSWORD='your-password'", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) > 1 and sys.argv[1] == "-f":
        with open(sys.argv[2]) as f:
            sql = f.read()
    elif len(sys.argv) > 1:
        sql = sys.argv[1]
    elif not sys.stdin.isatty():
        sql = sys.stdin.read()
    else:
        print(__doc__.strip())
        sys.exit(1)

    sock = connect()

    statements = [s.strip() for s in sql.split(";") if s.strip()]
    exit_code = 0
    for stmt in statements:
        columns, rows, cmd_tag, has_error = execute(sock, stmt)
        if has_error:
            exit_code = 1
        if columns and rows:
            widths = [len(c) for c in columns]
            for row in rows:
                for i, val in enumerate(row):
                    widths[i] = max(widths[i], len(str(val if val is not None else "NULL")))
            header = " | ".join(c.ljust(w) for c, w in zip(columns, widths))
            sep = "-+-".join("-" * w for w in widths)
            print(header)
            print(sep)
            for row in rows:
                print(
                    " | ".join(
                        str(v if v is not None else "NULL").ljust(w)
                        for v, w in zip(row, widths)
                    )
                )
            print(f"({len(rows)} row{'s' if len(rows) != 1 else ''})")
            print()
        elif cmd_tag:
            print(cmd_tag)
            print()

    sock.sendall(b"X\x00\x00\x00\x04")  # Terminate
    sock.close()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
