import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "./Providers";

export const metadata = {
  title: "Value Navigator",
  description: "Scenario-based value forecasting SaaS"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var c=localStorage.getItem("value-navigator-background-color");if(c)document.documentElement.style.setProperty("--app-bg",c);})();`
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

