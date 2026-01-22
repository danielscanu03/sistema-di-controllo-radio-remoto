Write-Host "Creating virtual environment..."
python -m venv venv

Write-Host "Activating virtual environment..."
. .\venv\Scripts\Activate.ps1

Write-Host "Installing dependencies..."
pip install --upgrade pip
pip install -r venv_requirements.txt

Write-Host "Environment ready!"