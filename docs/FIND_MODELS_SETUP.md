# Find Models Feature - Environment Setup

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Existing variables
GOOGLE_API_KEY=your_google_api_key
NEXT_PUBLIC_DEMO_MODE=false

# NEW: Required for Find Models feature
APIFY_API_TOKEN=your_apify_api_token
```

## Getting Your Apify API Token

1. Go to [https://apify.com](https://apify.com)
2. Sign up or log in
3. Navigate to Settings → Integrations → API tokens
4. Copy your API token
5. Add it to `.env.local`

## Testing the Feature

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the Find Models page**:
   ```
   http://localhost:3000/find-models
   ```

3. **Test Natural Language Search**:
   - Click "Natural Language Search" button
   - Try queries like:
     - "mechanical gears for engineering"
     - "downloadable robot in GLB format"
     - "popular sci-fi vehicles"
     - "low poly cars"
   - Click "Search" button
   - Verify AI converts query to search parameters
   - Verify results display with thumbnails, creator info, stats

4. **Test Manual Filters**:
   - Click "Manual Filters" button
   - Fill in:
     - Keywords: "robot"
     - Tags: "mechanical, sci-fi"
     - Categories: "science-technology"
     - File Format: "GLB"
     - Sort By: "Most Liked"
   - Click "Search Models"
   - Verify search executes with exact parameters

5. **Test Model Card Interactions**:
   - Click on any model card
   - Verify modal opens with iframe preview
   - Verify model details display (views, likes, faces, vertices)
   - Click creator profile link → opens Sketchfab profile in new tab
   - Click "View on Sketchfab" → opens model page in new tab
   - If downloadable, verify download button appears
   - Close modal by clicking X or outside modal

6. **Verify Attributions**:
   - Scroll to footer
   - Verify "Models provided by Sketchfab" with clickable link
   - Verify "Search powered by Apify" with clickable link
   - Verify legal disclaimer about respecting licenses

## API Endpoint

**POST** `/api/search-models`

**Natural Language Mode**:
```json
{
  "mode": "natural",
  "query": "mechanical gears for engineering"
}
```

**Manual Mode**:
```json
{
  "mode": "manual",
  "manualFilters": {
    "q": "robot",
    "tags": ["mechanical", "sci-fi"],
    "categories": ["science-technology"],
    "file_format": "glb",
    "sort_by": "likeCount"
  }
}
```

**Response**:
```json
{
  "success": true,
  "count": 10,
  "searchParams": { ... },
  "models": [ ... ],
  "attribution": {
    "sketchfab": "Models provided by Sketchfab",
    "apify": "Search powered by Apify",
    "message": "All models are property of their respective creators..."
  }
}
```

## Features Implemented

✅ **AI-Powered Natural Language Search**
- Gemini converts user queries to Sketchfab parameters
- Temperature: 0.3 for consistent results
- Structured output with Zod schema validation

✅ **Manual Filter Control** 
- Keywords, tags, categories
- File format selection (GLB, GLTF, FBX, OBJ)
- License filtering (CC variants, CC0)
- Sort options (relevance, likes, views, recent)

✅ **Beautiful Dark-Themed UI**
- Gradient backgrounds matching Three21 aesthetic
- Glass-morphism cards
- Smooth hover effects and transitions
- Responsive grid layout

✅ **Model Cards**
- High-quality thumbnails
- Creator info with avatar
- View/like counts
- Tag display
- Downloadable badge

✅ **Interactive Preview Modal**
- Embedded Sketchfab iframe
- Full model description
- Detailed stats (views, likes, faces, vertices)
- Links to Sketchfab page and creator profile
- License information
- Download button (if available)

✅ **Proper Attribution & Legal**
- Sketchfab credit with link
- Apify credit with link
- Creator profile links (clickable avatars/names)
- License disclaimers
- Respect for intellectual property

## Architecture

```
┌─────────────────────────────────────────┐
│  User Input (Natural Language/Manual)   │
└──────────────┬──────────────────────────┘
               │
               ▼
     ┌─────────────────────┐
     │ Frontend (Next.js)  │
     │ /find-models        │
     └─────────┬───────────┘
               │ POST /api/search-models
               ▼
     ┌─────────────────────┐
     │  API Route          │
     │  (Node.js runtime)  │
     └─────────┬───────────┘
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
┌──────────┐    ┌──────────────┐
│ Gemini   │    │ Direct Apify │
│ AI (NL)  │    │ (Manual)     │
└────┬─────┘    └──────┬───────┘
     │                 │
     └────────┬────────┘
              ▼
     ┌────────────────┐
     │ Apify Client   │
     │ Sketchfab      │
     │ Actor          │
     └────────┬───────┘
              │
              ▼
     ┌────────────────┐
     │ Results        │
     │ (JSON Array)   │
     └────────────────┘
```

## Troubleshooting

**Error: "APIFY_API_TOKEN is not defined"**
- Verify `.env.local` has `APIFY_API_TOKEN=your_token`
- Restart dev server after adding environment variables

**Error: "Module 'apify-client' not found"**
- Run: `npm install apify-client`

**No results returned**
- Try broader search terms
- Check Apify actor is running correctly
- Verify API token has sufficient credits

**AI search not working**
- Verify `GOOGLE_API_KEY` is set
- Check Gemini API quota
- Fall back to manual search mode

## Notes

- The Apify actor ID used: `tCErBTV7dcifSOlkU` (Sketchfab Search)
- Default timeout: 30 seconds (extended for AI processing)
- Runtime: Node.js (required for Apify client)
- All external links open in new tabs with proper security attributes
