## Value Navigator – SaaS Web Application

Value Navigator is a SaaS web application for building business scenarios and viewing forecast results.

### Architecture Overview

- **Frontend**: `frontend` – Next.js (React, TypeScript, App Router) with:
  - Drag-and-drop scenario builder
  - Scenario editor
  - Dashboard with forecast results
- **Backend**: `backend/ValueNavigator.Api` – ASP.NET Core Web API (.NET 8 style) with:
  - REST endpoints for running forecasts
  - Data access layer that calls **Azure SQL stored procedures** (no inline SQL)
- **Database**: Azure SQL with stored procedures such as `usp_RunForecastScenario`
- **Authentication**: Microsoft Entra ID (Azure AD) using:
  - MSAL.js on the frontend
  - `Microsoft.Identity.Web` JWT bearer auth on the backend
- **Hosting**: Azure App Service (separate apps for frontend and backend, or combined if desired).

See **[Deploy to Azure App Service](docs/DEPLOY-AZURE-APP-SERVICE.md)** for step-by-step deployment and Entra ID setup.

### Local Structure

- `frontend/`
  - Next.js app (App Router) UI
  - Pages for dashboard, scenario builder, and scenario editor
- `backend/ValueNavigator.Api/`
  - ASP.NET Core-style Web API
  - `Controllers/ForecastController.cs` – runs forecasts via stored proc
  - `Data/ForecastRepository.cs` – encapsulates Azure SQL access
  - `appsettings.json` – Entra ID + connection string placeholders
- `database/`
  - Example Azure SQL schema and stored procedure script

### Configuration (High Level)

- **Frontend** (set in environment, e.g. `.env.local`):
  - `NEXT_PUBLIC_AZURE_AD_CLIENT_ID`
  - `NEXT_PUBLIC_AZURE_AD_TENANT_ID`
  - `NEXT_PUBLIC_API_BASE_URL` (points to the backend App Service)
- **Backend** (`appsettings.json` / App Service configuration):
  - `AzureAd:TenantId`
  - `AzureAd:ClientId`
  - `AzureAd:Instance`
  - `AzureAd:Audience` (API Application ID URI)
  - `ConnectionStrings:DefaultConnection` (Azure SQL)

### Deployment (Azure App Service – Summary)

- **Frontend**:
  - Build with `npm install && npm run build` in `frontend`.
  - Deploy the `.next` output (or use Azure Static Web Apps / App Service with Node).
- **Backend**:
  - Build/publish with `dotnet publish -c Release` in `backend/ValueNavigator.Api`.
  - Deploy the published output to an App Service (Linux or Windows).
  - Configure Entra ID authentication and connection strings in App Service settings.

See the `frontend` and `backend` folders for more details.

