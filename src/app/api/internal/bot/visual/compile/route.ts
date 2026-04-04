import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || "http://python-compiler:8000";
const R_COMPILER_URL = process.env.R_COMPILER_URL || "http://r-compiler:8000";

// R auto-installer wrapper (same as agent/visualize)
function wrapRCode(rawCode: string) {
    return `
options(repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"))
.orig_lib <- base::library
library <- function(package, ...) {
  pkg_name <- as.character(substitute(package))
  if (length(pkg_name) == 1 && pkg_name != "package") {
    if (!requireNamespace(pkg_name, quietly = TRUE)) {
        suppressMessages(suppressWarnings(install.packages(pkg_name, quiet = TRUE)))
    }
    invisible(suppressPackageStartupMessages(suppressWarnings(.orig_lib(pkg_name, character.only = TRUE, quietly = TRUE))))
  } else {
    invisible(suppressPackageStartupMessages(suppressWarnings(.orig_lib(...))))
  }
}
` + rawCode;
}

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { code, language = "python" } = await req.json();
        
        if (!code) {
            return NextResponse.json({ error: "No code provided" }, { status: 400 });
        }

        const isPython = language === "python";
        const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;
        const finalCode = isPython ? code : wrapRCode(code);

        const response = await fetch(`${compilerUrl}/compile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: finalCode }),
            signal: AbortSignal.timeout(45000),
        });

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: `Compiler Error: ${err}` }, { status: 502 });
        }

        const result = await response.json();
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
