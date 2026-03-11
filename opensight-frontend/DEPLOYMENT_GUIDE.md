# Multi-Language Deployment Guide

This guide explains how to deploy the frontend to multiple domains with different languages using Vercel.

## Overview

The frontend uses i18next for internationalization and supports multiple languages. The language is determined at build time via the `VITE_LANG` environment variable.

## Supported Languages

- English (`en`) - Default
- Turkish (`tr`)

## Deployment Setup

### English Site (site1.com)

1. **Vercel Project**: Use your existing Vercel project
2. **Environment Variables**: 
   - Set `VITE_LANG=en` (or leave unset, as `en` is the default)
3. **Build Command**: `npm run build` or `yarn build`
4. **Output Directory**: `dist`
5. **Domain**: Configure your English domain in Vercel project settings

### Turkish Site (site2.com)

1. **Vercel Project**: Create a new Vercel project (or use a separate branch/environment)
2. **Environment Variables**:
   - Set `VITE_LANG=tr` in Vercel project settings
3. **Build Command**: `npm run build` or `yarn build`
4. **Output Directory**: `dist`
5. **Domain**: Configure your Turkish domain in Vercel project settings

## Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Key**: `VITE_LANG`
   - **Value**: `tr` (for Turkish) or `en` (for English)
   - **Environment**: Select all environments (Production, Preview, Development)
4. Click **Save**

## How It Works

- The `VITE_LANG` environment variable is read by Vite during the build process
- The i18n configuration in `src/i18n/config.js` uses this variable to set the default language
- Each build produces a language-specific version of the application
- The language is locked at build time, ensuring consistent deployments

## Adding New Languages

To add a new language:

1. Create a new translation file in `src/i18n/locales/` (e.g., `fr.json` for French)
2. Update `src/i18n/config.js` to import and include the new language
3. Deploy with `VITE_LANG=fr` (or your language code)

## Notes

- Each domain deployment is independent
- You can deploy updates to one language without affecting the other
- The same codebase is used for all languages
- Translation files are included in all builds but only the selected language is active

