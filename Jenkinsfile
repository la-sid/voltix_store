// Jenkins pipeline for Windows. Needs only Node.js on the Jenkins machine (no Docker, no Docker Hub).
pipeline {
    agent any

    environment {
        APP_DIR  = 'C:\\voltix-store'   // where the live copy of the store runs from
        APP_PORT = '3001'
    }

    options {
        timestamps()
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Check Node') {
            steps { bat 'node -v' }
        }

        stage('Test') {
            steps { bat 'npm test' }
        }

        stage('Deploy') {
            steps {
                // 1. Stop the previous version if it is running
                bat returnStatus: true, script: '''powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %APP_PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"'''

                // 2. Copy the new version into the live folder (robocopy codes below 8 mean success)
                script {
                    def rc = bat(returnStatus: true, script: 'robocopy "%WORKSPACE%" "%APP_DIR%" server.js products.js index.html package.json /NFL /NDL /NJH /NJS /NP')
                    if (rc >= 8) { error("Copy failed (robocopy code ${rc})") }
                }

                // 3. Start it in the background so it keeps running after the build ends
                withEnv(['BUILD_ID=dontKillMe', 'JENKINS_NODE_COOKIE=dontKillMe']) {
                    bat '''powershell -NoProfile -Command "Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.js' -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden -RedirectStandardOutput '%APP_DIR%\\server.log' -RedirectStandardError '%APP_DIR%\\server-error.log'"'''
                }
            }
        }

        stage('Verify') {
            steps {
                // Fails the build unless the live store really serves 30+ products
                bat '''powershell -NoProfile -Command "$ok=$false; for($i=0;$i -lt 20;$i++){ try { $r=Invoke-RestMethod http://localhost:%APP_PORT%/api/products; if($r.Count -ge 30){ $ok=$true; Write-Output ('Store is live with ' + $r.Count + ' products'); break } } catch {}; Start-Sleep 1 }; if(-not $ok){ exit 1 }"'''
            }
        }
    }

    post {
        success { echo "Done! Open http://localhost:${env.APP_PORT} in your browser." }
        failure { echo 'Pipeline failed. Open the failed stage in Console Output.' }
    }
}
