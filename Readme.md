# Auro Info Tech Solution Website

## Overview
This repository contains the source code and documentation for the official **Auro Info Tech Solution** website. The website is designed to provide information about the company, its services, solutions, products, and contact details while offering a modern, responsive, and user-friendly experience.

## Project Objectives
- Establish a professional online presence for Auro Info Tech Solution.
- Showcase company services and expertise.
- Improve customer engagement and lead generation.
- Provide easy access to company information and contact channels.
- Ensure responsive and accessible user experience across devices.

## Features
- Responsive design for desktop, tablet, and mobile devices.
- Modern and intuitive user interface.
- Bold geometric Sora headings and Space Grotesk body text with responsive font sizes.
- Blue-and-black gradients with decorative blurred background shapes and matching service illustrations.
- One-page sections for the freelance approach, services, and project process.
- FAQ accordion for common project enquiries.
- Persistent light/dark theme toggle.
- Alternating left/right scroll entrances, opposing hero entrances, and preview float effects that respect reduced-motion preferences.
- Short animated logo intro that fades away automatically and is skipped for reduced motion or keyboard navigation.
- Service links preselect the matching option in the contact form.
- Contact form validates required fields and prepares a reviewable email with email-app and copy-to-webmail options; it does not submit to a server.
- Basic SEO metadata and accessible navigation.

## Technology Stack

### Frontend
- HTML5, CSS3, and vanilla JavaScript

### Backend
- None currently. The contact form uses a `mailto:` link and does not store submissions.

### Deployment
- Can be hosted as a static website; no build step is currently required.

## Website checks

No framework, build step, or dependency installation is needed to serve the website.
Open `index.html` in your IDE's static preview, or publish the repository root to a static host.
Keep `index.html` at the root so existing hosting setups continue to work.

Run `npm run check` for JavaScript syntax checks and `npm test` for browser checks.
These commands require Node.js 22+; browser checks also require Microsoft Edge.
Set `BROWSER_PATH` to an Edge or Chrome executable if it is installed elsewhere.
The checks use an isolated headless browser and local server; no enquiries are sent.
They cover enquiry validation, email encoding, clipboard fallbacks, stale preview removal,
mobile navigation and focus, hover contrast, theme persistence and unavailable storage,
responsive layouts, image decoding, keyboard-operated FAQs, intro/reduced-motion behavior,
navigation without JavaScript, and relative assets under a deployment subpath.
Google Fonts are blocked during checks to exercise the local font fallbacks.
These local Edge/Chromium checks do not verify a live host, other browser engines,
or email delivery; sending an enquiry still requires the visitor's email service.

## Project Structure

```text
.
├── index.html
├── assets/
│   ├── styles/
│   │   └── site.css
│   ├── scripts/
│   │   └── site.js
│   └── images/
│       ├── brand/
│       │   └── auro-logo.svg
│       └── services/
│           ├── website-development.svg
│           ├── ecommerce-development.svg
│           ├── php-backend-development.svg
│           ├── website-maintenance.svg
│           ├── search-engine-optimization.svg
│           └── domain-hosting.svg
├── tests/
│   └── browser/
│       └── project-enquiry.test.cjs
├── package.json
└── Readme.md
```

## Editing guide

- `index.html`: page content, navigation, service descriptions, and enquiry markup.
- `assets/styles/site.css`: theme tokens, layouts, typography, and animations.
- `assets/scripts/site.js`: navigation, theme switching, scroll animations, and enquiry behavior.
- `assets/images/brand`: shared brand assets, including the favicon and watermark source.
- `assets/images/services`: descriptive, lowercase kebab-case filenames for each service illustration.
- `tests/browser`: isolated browser regression checks; never sends an enquiry.