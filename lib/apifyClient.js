import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token from environment variables
const client = new ApifyClient({
    token: process.env.APIFY_API_KEY,
});

/**
 * Scrapes Google Scholar using Apify Actor.
 * STRICT LIMITS: Always returns max 10 items, starting from 2022
 * @param {Object} params - The parameters for the scrape.
 * @param {string} params.query - The search query (REQUIRED).
 * @param {number} [params.maxItems=10] - Max items (IGNORED - always 10).
 * @param {boolean} [params.includeCitations=true] - Whether to include citations.
 * @param {number} [params.minYear=2022] - Minimum year for results (default 2022).
 * @param {number} [params.maxYear] - Maximum year for results.
 * @param {string} [params.country] - Google Country (gl), e.g., 'us', 'uk'.
 * @param {string} [params.language] - UI Language (hl), e.g., 'en'.
 * @param {string} [params.languageResults] - Language Results (lr), e.g., 'lang_en'.
 * @param {string} [params.patentsCourts] - Patents and courts filter (0=all, 1=exclude patents).
 * @param {string} [params.sortBy] - Sort parameter (scisbd), 2=date.
 * @returns {Promise<Array>} - The list of scraped items (max 10).
 */
export async function searchGoogleScholar({
    query,
    maxItems = 10, // This will be ignored - strict limit enforced below
    includeCitations = true,
    minYear = 2022, // Updated to 2022 for more recent research
    maxYear,
    country,
    language,
    languageResults,
    patentsCourts,
    sortBy
}) {
    if (!query) {
        throw new Error("Query is required");
    }

    // STRICT: Always use exactly 10 items, ignoring any user input
    const input = {
        queries: query,
        maxItems: 10, // ENFORCED: Always 10, never more
        includeCitations: includeCitations,
        organicResults: true,
        filter: 1,
        nfpr: 1,
        ...(minYear && { start_year: minYear }),
        ...(maxYear && { end_year: maxYear }),
        ...(country && { gl: country }),
        ...(language && { hl: language }),
        ...(languageResults && { lr: languageResults }),
        ...(patentsCourts && { scholar_patents_courts: patentsCourts }),
        ...(sortBy && { scisbd: sortBy })
    };

    try {
        console.log('🔍 Apify Actor Input:', JSON.stringify(input, null, 2));

        // Run the Actor and wait for it to finish
        // Actor ID: QE5aLx6lA6uGUXesU (Google Scholar Scraper)
        const run = await client.actor("QE5aLx6lA6uGUXesU").call(input);

        // Fetch and print Actor results from the run's dataset (if any)
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        console.log(`✅ Apify Actor returned ${items.length} items and ${items}`);

        return items;
    } catch (error) {
        console.error("❌ Apify Google Scholar Scrape Error:", error);
        throw error;
    }
}
