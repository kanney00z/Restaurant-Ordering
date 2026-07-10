import { app } from "../server";

export default async function handler(req: any, res: any) {
  try {
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
