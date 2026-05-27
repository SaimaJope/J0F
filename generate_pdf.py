import subprocess
import os

html_path = os.path.abspath("proposal.html")
pdf_path = os.path.abspath("JobFuture_Project_Proposal.pdf")
file_url = f"file:///{html_path.replace(os.sep, '/')}"

browsers = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

browser = None
for b in browsers:
    if os.path.exists(b):
        browser = b
        break

if not browser:
    print("ERROR: No compatible browser found")
    exit(1)

print(f"Using: {browser}")

result = subprocess.run([
    browser,
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    "--run-all-compositor-stages-before-draw",
    f"--print-to-pdf={pdf_path}",
    "--print-to-pdf-no-header",
    "--no-pdf-header-footer",
    file_url
], capture_output=True, text=True, timeout=30)

if os.path.exists(pdf_path):
    size_kb = os.path.getsize(pdf_path) / 1024
    print(f"PDF generated successfully! ({size_kb:.0f} KB)")
else:
    print("Failed to generate PDF")
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
