# Render Deployment Guide

## ✅ Compatibility Check

Your application is **fully compatible** with Render:

- ✅ Flask app with `app:app` entry point
- ✅ Gunicorn in requirements.txt
- ✅ Procfile configured
- ✅ render.yaml configuration file
- ✅ Python 3.9+ compatible
- ✅ Environment variable support

## Quick Deploy Steps

### Option 1: Deploy via Render Dashboard (Recommended)

1. **Go to [Render Dashboard](https://dashboard.render.com)**
   - Sign up/Login with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub account
   - Select repository: `kavya5jan-prog/ema-claims`

3. **Configure Service**
   - **Name**: `ema-claims` (or your preferred name)
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - **Plan**: Free (or choose a paid plan)

4. **Add Environment Variable**
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
   - Click "Add"

5. **Deploy**
   - Click "Create Web Service"
   - Wait 2-5 minutes for deployment

Your app will be live at: `https://ema-claims.onrender.com`

### Option 2: Deploy via render.yaml (Auto-detected)

If you push `render.yaml` to your repo, Render will auto-detect it:

1. Push to GitHub (already done ✅)
2. Go to Render Dashboard
3. Click "New +" → "Blueprint"
4. Connect your GitHub repo
5. Render will auto-detect `render.yaml` and configure everything
6. Add `OPENAI_API_KEY` environment variable
7. Deploy

## Configuration Files

### render.yaml
```yaml
services:
  - type: web
    name: ema-claims
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app --bind 0.0.0.0:$PORT
    envVars:
      - key: OPENAI_API_KEY
        sync: false
    healthCheckPath: /
    plan: free
```

### Procfile
```
web: gunicorn app:app
```

### runtime.txt
```
python-3.11.7
```

## Environment Variables

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key

**Optional:**
- `SECRET_KEY` - Flask session secret (auto-generated if not set)
- `IMAGE_DPI` - Image processing DPI (default: 72)
- `MAX_IMAGE_DIMENSION` - Max image dimension (default: 2048)
- `SENDGRID_API_KEY` - For email functionality (optional)
- `SENDGRID_FROM_EMAIL` - Email sender address (optional)

## Important Notes

### Free Tier Limitations
- ⚠️ **Cold Starts**: First request after 15 min inactivity takes ~50 seconds
- ⚠️ **Sleep Mode**: App sleeps after 15 minutes of inactivity
- ⚠️ **Build Time**: Limited build minutes per month
- ✅ **Solution**: Upgrade to paid plan for always-on service

### File Uploads
- ✅ Uses `uploads/` directory (created automatically)
- ✅ Max file size: 16MB
- ✅ Files are processed and cleaned up automatically

### Port Configuration
- ✅ Render automatically sets `PORT` environment variable
- ✅ App uses `PORT` if available, defaults to 5001
- ✅ Gunicorn binds to `0.0.0.0:$PORT`

## Troubleshooting

### Build Fails
- **Issue**: Python version mismatch
  - **Solution**: Check `runtime.txt` specifies compatible Python version (3.9+)

- **Issue**: Missing dependencies
  - **Solution**: Verify all packages in `requirements.txt` are correct

### App Not Starting
- **Issue**: Port binding error
  - **Solution**: Ensure start command uses `$PORT` variable

- **Issue**: Import errors
  - **Solution**: Check that `app.py` is in root directory

### Environment Variables
- **Issue**: `OPENAI_API_KEY` not found
  - **Solution**: Add it in Render dashboard → Environment tab

### Cold Start Delays
- **Issue**: First request is slow (~50 seconds)
  - **Solution**: This is normal on free tier. Upgrade to paid plan for always-on.

## Monitoring

- View logs: Render Dashboard → Your Service → Logs
- Check metrics: Render Dashboard → Your Service → Metrics
- View environment variables: Render Dashboard → Your Service → Environment

## Cost

- **Free Tier**: 
  - 750 hours/month
  - Sleeps after 15 min inactivity
  - Perfect for development/testing
  
- **Starter Plan** ($7/month):
  - Always-on service
  - No cold starts
  - Better for production

## Next Steps After Deployment

1. ✅ Test your app at the provided URL
2. ✅ Verify file uploads work
3. ✅ Check OpenAI API integration
4. ✅ Set up custom domain (optional)
5. ✅ Configure monitoring/alerts (optional)

Your app is ready to deploy! 🚀

