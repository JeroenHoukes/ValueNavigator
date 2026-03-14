-- Value Navigator – Azure SQL schema and stored procedure for running forecasts.
-- Run this script against your Azure SQL database (e.g. ValueNavigator).

-- Optional: table to persist scenario metadata (referenced by ScenarioId in the proc).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Scenarios')
BEGIN
  CREATE TABLE dbo.Scenarios (
    Id NVARCHAR(50) NOT NULL PRIMARY KEY,
    Name NVARCHAR(256) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    HorizonYears INT NOT NULL,
    DiscountRate DECIMAL(10, 4) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

-- Stored procedure: runs a forecast and returns NPV, IRR, and payback period.
-- The API calls this procedure only; no inline SQL for forecast logic.
CREATE OR ALTER PROCEDURE dbo.usp_RunForecastScenario
  @ScenarioId   NVARCHAR(50)  = NULL,
  @Name         NVARCHAR(256) = NULL,
  @Description  NVARCHAR(MAX) = NULL,
  @HorizonYears INT           = 5,
  @DiscountRate DECIMAL(10,4) = 8.0
AS
SET NOCOUNT ON;

-- Example implementation: compute placeholder NPV/IRR/Payback from inputs.
-- Replace with your real forecast logic (e.g. cash flow projection, discounting).
DECLARE @Npv DECIMAL(18,2);
DECLARE @Irr DECIMAL(10,2);
DECLARE @PaybackPeriodYears DECIMAL(10,2);

SET @Npv = 1000000.00 * @HorizonYears * (1 - @DiscountRate / 100.0);
SET @Irr = 5.0 + (@HorizonYears * 2) + (@DiscountRate * 0.5);
SET @PaybackPeriodYears = CASE WHEN @HorizonYears <= 0 THEN 0 ELSE CAST(@HorizonYears AS DECIMAL(10,2)) * 0.6 END;

SELECT
  @Npv                  AS Npv,
  @Irr                  AS Irr,
  @PaybackPeriodYears   AS PaybackPeriodYears;
GO
