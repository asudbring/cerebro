# Iteration path calculator

Azure DevOps iteration paths follow the Microsoft fiscal year calendar.

## Algorithm

Given the current date, calculate the iteration path as: `Content\FY{YY}\Q{Q}\{MM} {MonthName}`

### Fiscal year rules

- Microsoft fiscal year runs **July 1 to June 30**.
- FY number = current year + 1 if month is July–December, current year if January–June.
  - Example: November 2025 → FY**26** (2025 + 1)
  - Example: March 2026 → FY**26** (2026)

### Quarter mapping

| Calendar Months | Fiscal Quarter |
|---|---|
| July, August, September | Q1 |
| October, November, December | Q2 |
| January, February, March | Q3 |
| April, May, June | Q4 |

### Month format

- Two-digit month number + space + three-letter abbreviation.
- Examples: `07 Jul`, `01 Jan`, `12 Dec`

### Complete examples

| Date | FY | Quarter | Month | Iteration Path |
|---|---|---|---|---|
| July 15, 2025 | FY26 | Q1 | 07 Jul | `Content\FY26\Q1\07 Jul` |
| November 1, 2025 | FY26 | Q2 | 11 Nov | `Content\FY26\Q2\11 Nov` |
| January 20, 2026 | FY26 | Q3 | 01 Jan | `Content\FY26\Q3\01 Jan` |
| March 23, 2026 | FY26 | Q3 | 03 Mar | `Content\FY26\Q3\03 Mar` |
| April 5, 2026 | FY26 | Q4 | 04 Apr | `Content\FY26\Q4\04 Apr` |
