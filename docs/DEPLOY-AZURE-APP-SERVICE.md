# Azure App Service deployment – Value Navigator

This document describes how to deploy the Value Navigator frontend and backend to Azure App Service.

## Prerequisites

- Azure subscription
- Azure CLI (`az`) or Azure Portal
- .NET 8 SDK (for building the API)
- Node.js 18+ (for building the frontend)
- Microsoft Entra ID (Azure AD) app registrations for auth

## 1. Azure resources

Create (or reuse):

- **Resource group**: e.g. `rg-value-navigator`
- **Azure SQL Database**: server + database (e.g. `ValueNavigator`). Run `database/01-schema-and-usp.sql` to create the stored procedure.
- **App Service plan**: e.g. B1 or higher (Linux or Windows).
- **Two App Services** (or one for API and Static Web App for frontend):
  - `value-navigator-api` – hosts the ASP.NET Core API
  - `value-navigator-app` – hosts the Next.js app (Node runtime) **or** use **Azure Static Web Apps** and deploy the Next.js static export / standalone output

## 2. Entra ID (Azure AD) configuration

1. **API app registration**
   - In Azure Portal → Microsoft Entra ID → App registrations → New registration (e.g. `Value Navigator API`).
   - Expose an API: set **Application ID URI** to `api://<client-id>` (or your chosen value).
   - Add a scope if needed (e.g. `Forecast.Run`).
   - Note: **Application (client) ID**, **Directory (tenant) ID**.

2. **SPA (frontend) app registration**
   - New registration (e.g. `Value Navigator SPA`).
   - Authentication: Single-page application, add redirect URI (e.g. `https://value-navigator-app.azurewebsites.net`, `http://localhost:3000`).
   - API permissions: add permission to the API app (e.g. `Forecast.Run` or the default scope).

3. **Backend configuration**
   - In the API’s app registration: ensure the SPA’s client ID is allowed to call the API (e.g. in “Expose an API” → “Authorized client applications” or via API permissions on the SPA).

## 3. Backend (ASP.NET Core API) deployment

### Build and publish locally

```bash
cd backend/ValueNavigator.Api
dotnet publish -c Release -o ./publish
```

### Deploy to App Service

- **Option A – Azure CLI**

  ```bash
  az webapp deployment source config-zip --resource-group rg-value-navigator --name value-navigator-api --src ./publish.zip
  ```

  (Create `publish.zip` from the `publish` folder.)

- **Option B – VS / VS Code**
  - Use the “Azure App Service” extension and deploy the published folder.

- **Option C – GitHub Actions / Azure DevOps**
  - Build with `dotnet publish -c Release`, then deploy the resulting folder to the web app (e.g. `az webapp deploy` or Publish task).

### App Service application settings

Set these in the API App Service → Configuration → Application settings:

| Name | Description |
|------|-------------|
| `AzureAd__Instance` | `https://login.microsoftonline.com/` |
| `AzureAd__TenantId` | Directory (tenant) ID |
| `AzureAd__ClientId` | API app’s Application (client) ID |
| `AzureAd__Audience` | API Application ID URI (e.g. `api://<api-client-id>`) |
| `ConnectionStrings__DefaultConnection` | Azure SQL connection string (or reference Key Vault) |
| `Cors__AllowedOrigins` | Frontend origin(s), e.g. `https://value-navigator-app.azurewebsites.net,http://localhost:3000` |

Use double underscore `__` for nested keys in App Service settings.

## 4. Frontend (Next.js) deployment

### Build

```bash
cd frontend
npm ci
npm run build
```

### Deploy to App Service (Node)

- Set **Startup Command** to: `npm run start` (or `npx next start`).
- Deploy the entire app (including `node_modules` and `.next`) or use a deployment that runs `npm run build` on the server and then `npm run start`.

### Environment variables (frontend)

Configure in App Service → Configuration → Application settings (or `.env` in build):

| Name | Description |
|------|-------------|
| `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` | SPA app’s Application (client) ID |
| `NEXT_PUBLIC_AZURE_AD_TENANT_ID` | Directory (tenant) ID |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL (e.g. `https://value-navigator-api.azurewebsites.net`) |

## 5. Optional: enable auth on the API

In `ForecastController.cs`, uncomment:

```csharp
[Authorize]
```

Ensure the frontend acquires an access token (MSAL) for the API’s scope and sends it in the `Authorization: Bearer <token>` header when calling `/api/forecast/run`.

## 6. Health check (optional)

Add a simple health endpoint in the API for App Service or a load balancer:

```csharp
app.MapGet("/health", () => Results.Ok(new { status = "Healthy" }));
```

Then in App Service → Configuration → General settings, set **Health check path** to `/health` if desired.

---

Summary: deploy the API to an App Service with Entra ID and Azure SQL settings; deploy the Next.js app to another App Service or Static Web App with the same Entra ID tenant/client and the API base URL.
