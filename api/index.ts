let app: any = null;

export default async function handler(req: any, res: any) {
  try {
    if (!app) {
      console.log("Dynamically importing server...");
      try {
        const module = await import("../server.js");
        app = module.app;
      } catch (importErr: any) {
        console.warn("Failed to import with .js extension, trying without extension:", importErr);
        const module = await import("../server");
        app = module.app;
      }
    }
    
    if (typeof app === "function") {
      return app(req, res);
    } else {
      throw new Error("Exported app is not an Express function");
    }
  } catch (error: any) {
    console.error("Vercel Serverless Function Startup Error:", error);
    res.status(500).json({
      error: "Vercel Serverless Function Startup Error",
      message: error?.message || String(error),
      stack: error?.stack || "",
    });
  }
}
