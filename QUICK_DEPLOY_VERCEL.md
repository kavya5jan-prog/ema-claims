# Quick Deploy to Vercel

## Your app is ready to deploy! 🚀

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New..." → "Project"**
3. **Import your GitHub repository**: `kavya5jan-prog/autoclaim`
4. **Configure**:
   - Framework Preset: **Other**
   - Root Directory: `./` (default)
   - Build Command: (leave empty)
   - Output Directory: (leave empty)
   - Install Command: `pip install -r requirements.txt`
5. **Add Environment Variable**:
   - Key: `OPENAI_API_KEY`
   - Value: (your OpenAI API key)
   - Environments: Production, Preview, Development (select all)
6. **Click "Deploy"**

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI (if not installed)
npm install -g vercel

# Navigate to project directory
cd /Users/kavyak/Downloads/auto-claims

# Login to Vercel
vercel login

# Deploy
vercel

# Add environment variable
vercel env add OPENAI_API_KEY

# Deploy to production
vercel --prod
```

### Option 3: Use the deployment script

```bash
chmod +x deploy-vercel.sh
./deploy-vercel.sh
```

## After Deployment

Your app will be live at:
- **Production**: `https://autoclaim.vercel.app` (or your custom domain)
- **Preview**: Automatic preview URLs for each branch/PR

## Important Notes

✅ **Already Configured**:
- Flask app wrapper (`api/index.py`)
- Vercel configuration (`vercel.json`)
- Static file serving
- File upload handling (`/tmp` directory)
- Environment variable detection

⚠️ **Required**:
- Set `OPENAI_API_KEY` environment variable in Vercel dashboard
- Redeploy after adding environment variables

## Troubleshooting

**Build fails?**
- Check that all files are committed to git
- Verify `requirements.txt` has all dependencies
- Check build logs in Vercel dashboard

**App not working?**
- Verify `OPENAI_API_KEY` is set in environment variables
- Check function logs in Vercel dashboard
- Ensure you've redeployed after adding environment variables

**Need help?**
- See `VERCEL_DEPLOYMENT.md` for detailed guide
- See `VERCEL_SETUP_GUIDE.md` for troubleshooting

## Project Structure

```
auto-claims/
├── api/
│   └── index.py          # Vercel serverless function (Flask wrapper)
├── static/               # CSS, JS files
├── templates/            # HTML templates
├── app.py               # Flask application
├── vercel.json          # Vercel configuration ✅
├── requirements.txt     # Python dependencies ✅
└── README.md
```

Your app is configured and ready to deploy! 🎉

