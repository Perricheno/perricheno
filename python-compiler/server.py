import os
import tempfile
import subprocess
import base64
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

app = FastAPI()

class CompileRequest(BaseModel):
    code: str

MAX_EXEC_TIME = 30  # seconds

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/compile")
async def compile_python_code(req: CompileRequest):
    code = req.code
    
    if not code or not code.strip():
        return JSONResponse(status_code=400, content={"error": "No code provided"})

    tmp_dir = tempfile.mkdtemp(prefix="pythoncompile_")
    script_path = os.path.join(tmp_dir, "script.py")
    output_path = os.path.join(tmp_dir, "output.png")

    wrapper_code = f"""
import os
import sys

# Change to temp dir
os.chdir(r"{tmp_dir}")

{code}

# Auto-save plot logic
try:
    saved = False
    # Try saving Plotly figures first (if kaleido is available)
    if 'fig' in globals():
        try:
            import plotly.graph_objects as go
            if isinstance(fig, go.Figure):
                fig.write_image("output.png")
                saved = True
        except ImportError:
            pass
            
    if not saved:
        import matplotlib.pyplot as plt
        try:
            if 'fig' in globals():
                fig.savefig("output.png", dpi=120, bbox_inches="tight")
            else:
                plt.savefig("output.png", dpi=120, bbox_inches="tight")
        except Exception:
            plt.savefig("output.png", dpi=120, bbox_inches="tight")
except Exception as e:
    pass
"""

    with open(script_path, "w", encoding="utf-8") as f:
        f.write(wrapper_code)

    success = False
    log = ""
    exit_code = 1
    image_b64 = None

    try:
        result = subprocess.run(
            ["python", script_path],
            capture_output=True,
            text=True,
            timeout=MAX_EXEC_TIME
        )
        
        exit_code = result.returncode
        log = result.stdout + "\n" + result.stderr

        if exit_code == 0 and os.path.exists(output_path):
            success = True
            with open(output_path, "rb") as img_f:
                image_b64 = base64.b64encode(img_f.read()).decode("utf-8")

    except subprocess.TimeoutExpired as e:
        log = "Execution timed out after 30 seconds."
        exit_code = 124
    except Exception as e:
        log = str(e)
        exit_code = 1

    return {
        "success": success,
        "image": image_b64,
        "log": log.strip(),
        "exit_code": exit_code
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
