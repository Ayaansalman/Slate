pipeline {
    agent any

    environment {
        COMPOSE_FILE = 'docker-compose-ci.yml'
    }

    stages {
        stage('Clone Repository') {
            steps {
                echo 'Pulling latest code..'
                checkout scm
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                echo 'Deploying application...'
                sh 'docker compose -f ${COMPOSE_FILE} down'
                sh 'docker compose -f ${COMPOSE_FILE} up -d'
            }
        }
    }

    post {
        always {
            echo 'DONE!! Pipeline finished.'
        }
    }
}
