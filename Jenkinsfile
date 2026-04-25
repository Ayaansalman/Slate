pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'lazywitcher/slate'
        DOCKER_TAG   = 'latest'
    }

    stages {
        stage('Clone Repository') {
            steps {
                echo '📥 Pulling latest code...'
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                echo '🔨 Building Docker image...'
                sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} ."
            }
        }

        stage('Push to Docker Hub') {
            steps {
                echo '📤 Pushing image to Docker Hub...'
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push ${DOCKER_IMAGE}:${DOCKER_TAG}
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                echo '🚀 Deploying application...'
                sh '''
                    docker compose down || true
                    docker compose pull
                    docker compose up -d
                '''
            }
        }
    }

    post {
        success {
            echo '✅ Pipeline completed successfully! Slate is live.'
        }
        failure {
            echo '❌ Pipeline failed. Check logs above.'
        }
        always {
            sh 'docker image prune -f || true'
        }
    }
}
