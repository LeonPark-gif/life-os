# Life OS Installation Guide (Linux/Docker)

Follow these steps to set up Life OS on your Linux PC or as a Docker container.

## 1. Prerequisites (Git)

Before downloading, ensure you have Git installed:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install git -y
```

## 2. Download the Application

Clone the repository to your local machine:

```bash
git clone https://github.com/v-dasilva/life-os.git
cd life-os
```

## 3. Installation Methods

### Method A: Native Linux Installation (Recommended for Desktop)

1. **Install Node.js & Dependencies**:

   ```bash
   npm install
   ```

2. **Run Development Server**:

   ```bash
   npm run dev
   ```

3. **Build for Production** (optional):

   ```bash
   npm run build
   ```

### Method B: Docker Setup (Recommended for Servers)

1. **Build and Start Container**:

   ```bash
   docker-compose up -d --build
   ```

2. **Access the Application**:
   Open `http://localhost:5173` in your browser.

## 4. Configuration

- **Admin Access**: Switch to the **Admin** profile in the dashboard to configure Home Assistant and AI settings.
- **AI Settings**: Enter your API keys (OpenAI/Gemini) in the Admin Panel -> KI tab.
- **Calendar**: Configure CalDAV accounts in the Admin Panel -> Kalender tab.

---
*Note: This guide replaces `SETUP_LINUX_PC.md` and `DOCKER_SETUP.md` for a more streamlined experience.*
