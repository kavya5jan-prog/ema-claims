# GitHub Repository Setup

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Fill in:
   - **Repository name**: `auto-claims`
   - **Description**: "Auto Insurance Claims Analysis Tool"
   - **Visibility**: Public or Private (your choice)
   - **DO NOT** check "Initialize this repository with a README"
3. Click **"Create repository"**

## Step 2: Copy Your Repository URL

After creating, GitHub will show you a page with setup instructions. Copy the URL:

**HTTPS format:**
```
https://github.com/YOUR_USERNAME/auto-claims.git
```

**Or SSH format (if you have SSH keys set up):**
```
git@github.com:YOUR_USERNAME/auto-claims.git
```

## Step 3: Connect and Push Your Code

Run these commands in your terminal (replace `YOUR_REPO_URL` with the URL from Step 2):

```bash
cd /Users/kavyak/Downloads/auto-claims

# Add the remote repository
git remote add origin YOUR_REPO_URL

# Commit your files (if not already done)
git add .
git commit -m "Initial commit - Auto Claims Analysis App"

# Push to GitHub
git branch -M main
git push -u origin main
```

## Example

If your GitHub username is `johndoe`, your commands would be:

```bash
git remote add origin https://github.com/johndoe/auto-claims.git
git add .
git commit -m "Initial commit - Auto Claims Analysis App"
git branch -M main
git push -u origin main
```

## Troubleshooting

### If you get "remote origin already exists":
```bash
git remote remove origin
git remote add origin YOUR_REPO_URL
```

### If you need to authenticate:
- GitHub no longer accepts passwords for HTTPS
- Use a Personal Access Token instead:
  1. Go to: https://github.com/settings/tokens
  2. Click "Generate new token (classic)"
  3. Select scopes: `repo`
  4. Copy the token and use it as your password when pushing

### If you prefer SSH:
1. Set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
2. Use the SSH URL format instead

