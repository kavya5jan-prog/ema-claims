# Deploy to Vercel

This guide covers deploying the Auto Claims Analysis application to Vercel.

## Prerequisites

- GitHub repository (already set up: https://github.com/kavya5jan-prog/autoclaim)
- Vercel account (free tier available)
- OpenAI API key

## Step 1: Install Vercel CLI (Optional)

You can deploy via the web interface or CLI:

```bash
npm i -g vercel
```

## Step 2: Deploy via Vercel Dashboard (Recommended)

### Option A: Import from GitHub

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New..." → "Project"
3. Import your GitHub repository: `kavya5jan-prog/autoclaim`
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (default)
   - **Build Command**: Leave empty (Vercel will auto-detect)
   - **Output Directory**: Leave empty
   - **Install Command**: `pip install -r requirements.txt`
5. Add Environment Variables:
   - `OPENAI_API_KEY` = your OpenAI API key
6. Click "Deploy"

### Option B: Deploy via CLI

```bash
cd /Users/kavyak/Downloads/auto-claims

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Set environment variable
vercel env add OPENAI_API_KEY

# Deploy to production
vercel --prod
```

## Step 3: Configure Environment Variables

After deployment, add your environment variable:

1. Go to your project dashboard on Vercel
2. Click "Settings" → "Environment Variables"
3. Add:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key
   - **Environment**: Production, Preview, Development (select all)
4. Click "Save"
5. Redeploy to apply changes

## Important Notes for Vercel

### File Uploads
- Vercel uses `/tmp` directory for file uploads (configured automatically)
- Files are automatically cleaned up after function execution
- Maximum file size: 4.5MB (Vercel limit) or 16MB (app limit, whichever is smaller)

### Function Timeout
- Free tier: 10 seconds
- Pro tier: 60 seconds (configured in `vercel.json`)
- For longer operations, consider upgrading or optimizing

### Memory
- Configured to 3008MB in `vercel.json` for PDF processing
- Free tier includes 1024MB, Pro tier includes more

### Cold Starts
- First request may take 2-5 seconds (cold start)
- Subsequent requests are faster
- Consider Vercel Pro for better performance

## Troubleshooting

### Build Failures

**Issue**: Python dependencies not installing
- **Solution**: Ensure `requirements.txt` includes all dependencies
- Check build logs in Vercel dashboard

**Issue**: Import errors
- **Solution**: Verify `api/index.py` correctly imports from `app.py`
- Check that all files are committed to git

### Runtime Errors

**Issue**: File upload fails
- **Solution**: Ensure using `/tmp` directory (already configured)
- Check file size limits

**Issue**: Timeout errors
- **Solution**: Upgrade to Pro plan for 60-second timeout
- Or optimize PDF processing

**Issue**: Memory errors
- **Solution**: Upgrade to Pro plan for more memory
- Or optimize image/PDF processing

### Environment Variables

**Issue**: OpenAI API key not found
- **Solution**: 
  1. Go to Project Settings → Environment Variables
  2. Add `OPENAI_API_KEY`
  3. Redeploy the project

## Project Structure

```
auto-claims/
├── api/
│   └── index.py          # Vercel serverless function entry point
├── static/               # Static files (CSS, JS)
├── templates/            # HTML templates
├── app.py               # Flask application
├── vercel.json          # Vercel configuration
├── requirements.txt     # Python dependencies
└── Procfile             # (Not used on Vercel, but kept for other platforms)
```

## After Deployment

Your app will be available at:
- **Production**: `https://autoclaim.vercel.app` (or your custom domain)
- **Preview**: `https://autoclaim-git-branch.vercel.app` (for each branch)

## Custom Domain

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

## Monitoring

- View logs in Vercel dashboard
- Check function execution times
- Monitor error rates

## Cost

- **Free Tier**: 
  - 100GB bandwidth/month
  - 100 hours execution time/month
  - Perfect for development and small projects
  
- **Pro Tier** ($20/month):
  - More bandwidth
  - Longer function timeouts (60s)
  - More memory
  - Better performance

## Comparison: Vercel vs Render

| Feature | Vercel | Render |
|--------|-------|--------|
| Free Tier | ✅ Yes | ✅ Yes |
| Cold Starts | ~2-5s | ~50s |
| Function Timeout | 10s (free), 60s (pro) | 30s (free), unlimited (paid) |
| File Size Limit | 4.5MB | 16MB+ |
| Best For | Fast deployments, serverless | Traditional web apps |

Your app is now configured for Vercel! 🚀

