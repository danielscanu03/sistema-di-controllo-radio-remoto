Write-Host "Checking Python..."

try {
    $null = python --version
}
catch {
    Write-Host "Python non trovato."
    Write-Host "Installa Python da https://www.python.org/downloads/"
    exit 1
}

Write-Host "Creating virtual environment..."
python -m venv venv

Write-Host "Activating virtual environment..."
. .\venv\Scripts\Activate.ps1

Write-Host "Installing dependencies..."
python -m pip install --upgrade pip
python -m pip install -r venv_requirements.txt

Write-Host "Environment ready!"