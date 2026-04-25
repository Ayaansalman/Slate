# Slate — EC2 Deployment & CI/CD Guide

Complete step-by-step guide for deploying Slate on your AWS EC2 instance with Docker and Jenkins.

**Your Details:**
- EC2 IP: `13.53.46.134`
- Docker Hub: `lazywitcher`
- GitHub: `Ayaansalman`

---

## Part I: Docker Deployment

### Step 1 — SSH into your EC2 Instance

```bash
ssh -i your-key.pem ubuntu@13.53.46.134
```

### Step 2 — Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-v2

# Add your user to docker group (no sudo needed for docker commands)
sudo usermod -aG docker ubuntu

# IMPORTANT: Log out and back in for group change to take effect
exit
# SSH back in
ssh -i your-key.pem ubuntu@13.53.46.134

# Verify
docker --version
docker compose version
```

### Step 3 — Push Code to GitHub

On your **local machine** (in the assignment 2 folder):

```powershell
cd "c:\Users\ayaan\OneDrive\Documents\CUI ISL\DevOps\assignment 2"

git init
git add .
git commit -m "Initial commit - Slate Student Management System"
git branch -M main
git remote add origin https://github.com/Ayaansalman/slate.git
git push -u origin main
```

> **Note:** Create the repo `slate` on GitHub first at https://github.com/new (make it **public**, no README).

### Step 4 — Clone & Build on EC2

```bash
# On EC2
cd ~
git clone https://github.com/Ayaansalman/slate.git
cd slate

# Build the Docker image
docker build -t lazywitcher/slate:latest .

# Push to Docker Hub
docker login
# Enter your Docker Hub username (lazywitcher) and password
docker push lazywitcher/slate:latest
docker logout
```

### Step 5 — Deploy with Docker Compose

```bash
# Still in ~/slate on EC2
docker compose up -d

# Check containers are running
docker ps

# You should see:
# slate-app   → port 3000
# slate-mongo → MongoDB
```

### Step 6 — Verify

Open your browser and go to: **http://13.53.46.134:3000**

You should see Slate's UI! Try adding a student and a course.

### Verify Persistent Storage

```bash
# Check the volume exists
docker volume ls
# Should show: slate_mongo_data

# Restart containers to prove data persists
docker compose down
docker compose up -d
# Your data should still be there!
```

---

## Part II: Jenkins CI/CD Pipeline

### Step 1 — Install Jenkins on EC2

```bash
# Install Java (Jenkins requires it)
sudo apt install -y fontconfig openjdk-17-jre

# Add Jenkins repo
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc]" \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt update
sudo apt install -y jenkins

# Start Jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins

# Add Jenkins user to docker group
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

### Step 2 — Access Jenkins

1. Open: **http://13.53.46.134:8080**
2. Get the initial admin password:
   ```bash
   sudo cat /var/jenkins-home/secrets/initialAdminPassword
   ```
   If that doesn't work, try:
   ```bash
   sudo cat /var/lib/jenkins/secrets/initialAdminPassword
   ```
3. Paste it in the browser
4. Click **"Install suggested plugins"**
5. Create your admin user
6. Finish setup

### Step 3 — Add Docker Hub Credentials to Jenkins

1. Go to: **Jenkins Dashboard → Manage Jenkins → Credentials**
2. Click **(global)** → **Add Credentials**
3. Kind: **Username with password**
4. Username: `lazywitcher`
5. Password: Your Docker Hub password (or access token)
6. ID: `dockerhub-creds` ← **must match exactly**
7. Click **Create**

### Step 4 — Create a Jenkins Pipeline Job

1. Click **"New Item"** on the Dashboard
2. Name: `slate-pipeline`
3. Type: **Pipeline**
4. Click OK

5. Under **Pipeline** section:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: `https://github.com/Ayaansalman/slate.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`

6. Under **Build Triggers**:
   - Check: **GitHub hook trigger for GITScm polling**

7. Click **Save**

### Step 5 — Set Up GitHub Webhook

A webhook tells Jenkins to build automatically whenever you push code.

1. Go to your GitHub repo: **https://github.com/Ayaansalman/slate**
2. Click **Settings → Webhooks → Add webhook**
3. Payload URL: `http://13.53.46.134:8080/github-webhook/`
4. Content type: **application/json**
5. Events: **Just the push event**
6. Click **Add webhook**

> ✅ GitHub will send a ping — it should show a green checkmark.

### Step 6 — Test the Pipeline

**Option A — Manual trigger:**
1. Go to `slate-pipeline` in Jenkins
2. Click **"Build Now"**
3. Watch the stages execute in the **Stage View**

**Option B — Automatic trigger (webhook):**
1. Edit any file locally (e.g., change the title in index.html)
2. Commit and push:
   ```powershell
   git add .
   git commit -m "Test CI/CD pipeline"
   git push
   ```
3. Jenkins should automatically start building!

---

## Security Group Ports Checklist

Make sure these ports are open in your EC2 Security Group:

| Port | Protocol | Source    | Purpose        |
|------|----------|----------|----------------|
| 22   | TCP      | Your IP  | SSH access     |
| 3000 | TCP      | 0.0.0.0/0| Slate web app  |
| 8080 | TCP      | 0.0.0.0/0| Jenkins UI     |

---

## Useful Commands Cheat Sheet

```bash
# View running containers
docker ps

# View logs
docker logs slate-app
docker logs slate-mongo

# Restart everything
docker compose restart

# Full rebuild
docker compose down
docker build -t lazywitcher/slate:latest .
docker compose up -d

# Check Jenkins status
sudo systemctl status jenkins

# Check volumes (proves persistent storage)
docker volume inspect slate_mongo_data
```

---

## Troubleshooting

**Can't connect to http://13.53.46.134:3000?**
- Check Security Group has port 3000 open
- Run `docker ps` to confirm containers are running
- Run `docker logs slate-app` for errors

**Jenkins can't build Docker images?**
- Make sure Jenkins user is in docker group: `sudo usermod -aG docker jenkins`
- Restart Jenkins: `sudo systemctl restart jenkins`

**Webhook not triggering?**
- Check the webhook URL ends with `/github-webhook/` (trailing slash matters)
- Check Jenkins is accessible from the internet on port 8080
