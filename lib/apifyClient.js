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
 * @param {number} [params.minYear=2022] - Minimum year for results (default 2022).
 * @returns {Promise<Array>} - The list of scraped items (max 10).
 */
export async function searchGoogleScholar({
    query,
    maxItems = 20, // This will be ignored - strict limit enforced below
    minYear = 2022, // Updated to 2022 for more recent research
}) {
    if (!query) {
        throw new Error("Query is required");
    }

    // STRICT: Always use exactly 10 items, ignoring any user input
    const input = {
        keyword: query,
        maxItems: maxItems,
        filter: "all",
        newerThan: minYear,
        sortBy: "relevance",
        articleType: "any",
        proxyOptions: {
            useApifyProxy: true
        },
        enableDebugDumps: false
    };

    try {
        console.log('🔍 Apify Actor Input:', JSON.stringify(input, null, 2));
        const run = await client.actor("kdjLO0hegCjr5Ejqp").call(input);

        // Fetch and print Actor results from the run's dataset (if any)
        console.log('Results from dataset');
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        console.log(`✅ Apify Actor returned ${items.length} items and ${items}`);

        return items;
    } catch (error) {
        console.error("❌ Apify Google Scholar Scrape Error:", error);
        throw error;
    }
}


// Output
// {
//     "cidCode": "rvTRXmkWdSIJ",
//     "didCode": "rvTRXmkWdSIJ",
//     "lidCode": "",
//     "aidCode": "rvTRXmkWdSIJ",
//     "resultIndex": 3,
//     "type": "ARTICLE",
//     "title": "… OF THREE-TIME POINT ESTIMATION OF INFLAMMATORY MARKERS WITH THE SEVERITY AND OUTCOME IN PATIENTS OF COVID-19 IN A TERTIARY CARE …",
//     "link": "https://www.jpmi.org.pk/index.php/jpmi/article/view/3251",
//     "documentLink": "N/A",
//     "documentType": "N/A",
//     "fullAttribution": "M Hussain, S Orakzai, MM Dawood, A Ijaz… - Journal of Postgraduate …, 2024 - jpmi.org.pk",
//     "authors": "M Hussain, S Orakzai, MM Dawood, A Ijaz…",
//     "publication": "Journal of Postgraduate …",
//     "year": 2024,
//     "source": "jpmi.org.pk",
//     "searchMatch": "2 days ago - … COVID-19 Quality & Clinical Research Collaborative. C-reactive protein as a \nprognostic indicator in hospitalized patients with COVID-19. … fatalities caused by COVID-19: a …",
//     "citations": 0,
//     "citationsLink": "N/A",
//     "relatedArticlesLink": "https://scholar.google.com/scholar?q=related:rvTRXmkWdSIJ:scholar.google.com/&scioq=COVID-19&hl=en&scisbd=1&as_sdt=0,33",
//     "versions": 2,
//     "versionsLink": "https://scholar.google.com/scholar?cluster=2482915411382891694&hl=en&scisbd=1&as_sdt=0,33"
//   },
//   {
//     "cidCode": "UZ71Uw_IxggJ",
//     "didCode": "UZ71Uw_IxggJ",
//     "lidCode": "",
//     "aidCode": "UZ71Uw_IxggJ",
//     "resultIndex": 4,
//     "type": "ARTICLE",
//     "title": "Environmental Impact of Covid-19 Pandemic in Owerri Metropolis, Imo State of Nigeria",
//     "link": "https://hspublishing.org/GRES/article/view/363",
//     "documentLink": "N/A",
//     "documentType": "N/A",
//     "fullAttribution": "CV Amadi, RF Njoku-Tony - Global Research in Environment and …, 2024 - hspublishing.org",
//     "authors": "CV Amadi, RF Njoku-Tony",
//     "publication": "Global Research in Environment and …",
//     "year": 2024,
//     "source": "hspublishing.org",
//     "searchMatch": "2 days ago - … environmental impact of COVID-19 in Owerri metropolis … environmental impacts \nof COVID-19 pandemic in Owerri … environmental impact of COVID-19 pandemic in Owerri …",
//     "citations": 0,
//     "citationsLink": "N/A",
//     "relatedArticlesLink": "https://scholar.google.com/scholar?q=related:UZ71Uw_IxggJ:scholar.google.com/&scioq=COVID-19&hl=en&scisbd=1&as_sdt=0,33",
//     "versions": 0,
//     "versionsLink": "N/A"
//   },
//   {
//     "cidCode": "M3C8n-b4NGsJ",
//     "didCode": "M3C8n-b4NGsJ",
//     "lidCode": "",
//     "aidCode": "M3C8n-b4NGsJ",
//     "resultIndex": 5,
//     "type": "HTML",
//     "title": "Identification of factors affecting student academic burnout in online education during the COVID-19 pandemic using grey Delphi and grey-DEMATEL …",
//     "link": "https://www.nature.com/articles/s41598-024-53233-7",
//     "documentLink": "https://www.nature.com/articles/s41598-024-53233-7",
//     "documentType": "HTML",
//     "fullAttribution": "A Aria, P Jafari, M Behifar - Scientific Reports, 2024 - nature.com",
//     "authors": "A Aria, P Jafari, M Behifar",
//     "publication": "Scientific Reports",
//     "year": 2024,
//     "source": "nature.com",
//     "searchMatch": "2 days ago - … Although after the end of Covid-19, most educational institutions have returned \nto the … online education in the post-Covid-19 era by gaining valuable experience during the …",
//     "citations": 0,
//     "citationsLink": "N/A",
//     "relatedArticlesLink": "https://scholar.google.com/scholar?q=related:M3C8n-b4NGsJ:scholar.google.com/&scioq=COVID-19&hl=en&scisbd=1&as_sdt=0,33",
//     "versions": 0,
//     "versionsLink": "N/A"
//   },
//   {
//     "cidCode": "X68f7LOXWUoJ",
//     "didCode": "X68f7LOXWUoJ",
//     "lidCode": "",
//     "aidCode": "X68f7LOXWUoJ",
//     "resultIndex": 6,
//     "type": "ARTICLE",
//     "title": "Reframing the Service Environment in Collegiate Sport: A Transformative Sport Service Research Approach",
//     "link": "https://journals.ku.edu/jis/article/view/19739",
//     "documentLink": "N/A",
//     "documentType": "N/A",
//     "fullAttribution": "Y Yang, E Gray, K Kinoshita… - Journal of Intercollegiate …, 2024 - journals.ku.edu",
//     "authors": "Y Yang, E Gray, K Kinoshita…",
//     "publication": "Journal of Intercollegiate …",
//     "year": 2024,
//     "source": "journals.ku.edu",
//     "searchMatch": "2 days ago - This study applies a transformative sport service research approach to \nexamine student-athletes’ wellness within a collegiate sport setting. Sixteen semi-structured …",
//     "citations": 0,
//     "citationsLink": "N/A",
//     "relatedArticlesLink": "https://scholar.google.com/scholar?q=related:X68f7LOXWUoJ:scholar.google.com/&scioq=COVID-19&hl=en&scisbd=1&as_sdt=0,33",
//     "versions": 0,
//     "versionsLink": "N/A"
//   },
//   {
//     "cidCode": "1fxjSu8kPT4J",
//     "didCode": "1fxjSu8kPT4J",
//     "lidCode": "",
//     "aidCode": "1fxjSu8kPT4J",
//     "resultIndex": 7,
//     "type": "ARTICLE",
//     "title": "THE LEADERSHIP OF THE MADRASA PRINCIPAL IN ENHANCING LEARNING QUALITY AMIDST COVID-19 PANDEMIC IN CENTRAL ACEH REGENCY",
//     "link": "https://jurnal-assalam.org/index.php/JAS/article/view/703",
//     "documentLink": "N/A",
//     "documentType": "N/A",
//     "fullAttribution": "B Mizal, T Tathahira, RI Basith - Jurnal As-Salam, 2024 - jurnal-assalam.org",
//     "authors": "B Mizal, T Tathahira, RI Basith",
//     "publication": "Jurnal As-Salam",
//     "year": 2024,
//     "source": "jurnal-assalam.org",
//     "searchMatch": "2 days ago - … The COVID-19 pandemic is a scourge for education actors, especially school \nand … the quality of learning during the COVID-19 pandemic. This research is classified as …",
//     "citations": 0,
//     "citationsLink": "N/A",
//     "relatedArticlesLink": "https://scholar.google.com/scholar?q=related:1fxjSu8kPT4J:scholar.google.com/&scioq=COVID-19&hl=en&scisbd=1&as_sdt=0,33",
//     "versions": 2,
//     "versionsLink": "https://scholar.google.com/scholar?cluster=4484781414094732501&hl=en&scisbd=1&as_sdt=0,33"
//   },
// ...
