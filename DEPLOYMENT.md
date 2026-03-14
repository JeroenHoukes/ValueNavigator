# Deploying Value Navigator for a public URL

This guide helps you deploy the app so you can share a URL with others (e.g. `https://value-navigator.vercel.app`).

## 1. Deploy the frontend (Vercel)

The frontend is a Next.js app and can be deployed on [Vercel](https://vercel.com) in a few minutes.

### Option A: Deploy with Vercel CLI

```bash
cd frontend
npm i -g vercel
vercel
```

Follow the prompts (link to your Git repo if you have one, or deploy without). After the first deploy you’ll get a URL like `https://your-project.vercel.app`.

### Option B: Deploy via Vercel dashboard

1. Push your code to GitHub (or GitLab/Bitbucket).
2. Go to [vercel.com](https://vercel.com) and sign in.
3. **Add New Project** → Import your repository.
4. Set **Root Directory** to `frontend`.
5. Add environment variables (see below), then deploy.

### Environment variables (Vercel)

In the Vercel project: **Settings → Environment Variables**, add:

| Name | Value | Notes |
|------|--------|------|
| `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` | Your Azure AD app (client) ID | Required for login |
| `NEXT_PUBLIC_AZURE_AD_TENANT_ID` | Your Azure AD tenant ID | Required for login |
| `NEXT_PUBLIC_API_BASE_URL` | Your backend API URL | Optional; only if you deploy the API (e.g. `https://your-api.azurewebsites.net`) |
| `NEXT_PUBLIC_API_SCOPE` | API scope if using protected API | Optional |

Redeploy after changing env vars so the build picks them up.

---

## 2. Register the public URL in Azure AD (Microsoft Entra ID)

So login works when people open the shared link, you must register the production URL as a redirect URI.

1. Open [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** (or **Azure Active Directory**) → **App registrations**.
2. Open your **Value Navigator** app registration (the one whose Client ID you use in `NEXT_PUBLIC_AZURE_AD_CLIENT_ID`).
3. Go to **Authentication**.
4. Under **Single-page application** → **Add URI** add:
   - `https://your-project.vercel.app`  
   (or your exact Vercel URL, e.g. `https://value-navigator-xxx.vercel.app`).
5. If you use logout redirects, add the same URL under **Front-channel logout URL** (optional).
6. Save.

After this, anyone with access to your tenant (or to the app, depending on your Entra configuration) can open the shared URL and sign in.

---

## 3. Optional: Deploy the backend API

Most of the app (Gantt, Customer journey, Scenarios, Scenario Builder) works without the backend (data is stored in the browser). The **Run forecast** feature on the scenario edit page calls the API.

If you want that feature to work for shared users:

- Deploy the ASP.NET Core API to a host (e.g. **Azure App Service**, **Railway**, or a VPS).
- Set **CORS** to allow your frontend origin, e.g. `https://your-project.vercel.app`.
- Set `NEXT_PUBLIC_API_BASE_URL` in Vercel to your deployed API URL (no trailing slash).
- If the API is protected, set `NEXT_PUBLIC_API_SCOPE` and configure the API to accept tokens from your frontend app.

---

## 4. Sharing the URL

- Share the Vercel URL (e.g. `https://your-project.vercel.app`) with anyone who should use the app.
- They will be redirected to Microsoft login when they open it (if Azure AD is configured).
- Ensure those users have access to the app in your Entra ID tenant (or that the app is configured for “any Microsoft account” / “any org” if that’s what you want).

---

## Quick checklist

- [ ] Frontend deployed (e.g. Vercel) and URL works.
- [ ] `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` and `NEXT_PUBLIC_AZURE_AD_TENANT_ID` set in Vercel.
- [ ] Production URL added as **Redirect URI** in Azure AD app registration.
- [ ] (Optional) Backend deployed and `NEXT_PUBLIC_API_BASE_URL` set if you need the forecast API.

Once these are done, you can share the frontend URL publicly (within the limits of your Azure AD and API configuration).
