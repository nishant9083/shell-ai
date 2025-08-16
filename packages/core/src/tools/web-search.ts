import axios from 'axios';
import { load as cheerioLoad } from 'cheerio';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
// Search result interface
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  source: string;
  date?: string;
  type?: 'web' | 'news' | 'image' | 'video';
}

// Web search result interface (includes page metadata)
export interface WebSearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTime: number; // in milliseconds
  nextPage?: string;
  relatedQueries?: string[];
  error?: string;
}

export const WebSearchTool = new DynamicStructuredTool({
  name: 'web-search',
  description: 'Search the web for information using various search engines',
  schema: z.object({
    query: z.string().min(1).describe('The search query'),
    engine: z.enum(['google', 'duckduckgo', 'bing']).describe('Search engine to use'),
    numResults: z.number().min(1).default(10).describe('Number of results to return'),
    safeSearch: z.boolean().default(true).describe('Enable safe search filtering'),
    timeRange: z
      .enum(['any', 'day', 'week', 'month', 'year'])
      .default('any')
      .describe('Time range for results'),
    region: z
      .string()
      .default('us')
      .describe('Region/country code for localized results (e.g., "us", "uk", "de")'),
    type: z
      .enum(['web', 'news', 'image', 'video'])
      .default('web')
      .describe('Type of search results to return'),
    site: z.string().describe('Limit search to specific website domain (e.g., "example.com")'),
    fetchFullContent: z
      .boolean()
      .default(false)
      .describe('Fetch and include full content of the first result'),
  }),
  func: async (params: Record<string, unknown>) => {
    const {
      query,
      engine = 'google',
      numResults = 2,
      safeSearch = true,
      timeRange = 'any',
      region = 'us',
      type = 'web',
      site,
      fetchFullContent = false,
    } = params;

    if (typeof query !== 'string' || query.trim() === '') {
      return {
        success: false,
        data: undefined,
        error: 'Query parameter must be a non-empty string',
      };
    }

    try {
      const startTime = Date.now();
      let searchResults: WebSearchResponse;

      switch (engine) {
        case 'google':
          searchResults = await searchGoogle(
            query as string,
            numResults as number,
            safeSearch as boolean,
            timeRange as string,
            region as string,
            type as string,
            site as string
          );
          break;
        case 'duckduckgo':
          searchResults = await searchDuckDuckGo(
            query as string,
            numResults as number,
            safeSearch as boolean,
            region as string,
            type as string,
            site as string
          );
          break;
        case 'bing':
          searchResults = await searchBing(
            query as string,
            numResults as number,
            safeSearch as boolean,
            timeRange as string,
            region as string,
            type as string,
            site as string
          );
          break;
        default:
          return { success: false, data: undefined, error: `Unsupported search engine: ${engine}` };
      }

      searchResults.searchTime = Date.now() - startTime;

      // Fetch full content of the first result if requested
      if (fetchFullContent && searchResults.results.length > 0) {
        try {
          const firstResult = searchResults.results[0];
          const fullContent = await fetchPageContent(firstResult.url);

          return {
            success: true,
            data: {
              ...searchResults,
              fullContent: {
                url: firstResult.url,
                title: firstResult.title,
                content: fullContent,
              },
            },
          };
        } catch (error) {
          // If fetching full content fails, return just the search results
          return {
            success: true,
            data: searchResults,
            error: `Failed to fetch full content: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }

      return { success: true, data: searchResults };
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function searchGoogle(
  query: string,
  numResults: number,
  safeSearch: boolean,
  timeRange: string,
  region: string,
  type: string,
  site?: string
): Promise<WebSearchResponse> {
  let searchUrl = 'https://www.google.com/search?q=';

  // Construct search query with site parameter if provided
  let searchQuery = query;
  if (site) {
    searchQuery = `${searchQuery} site:${site}`;
  }

  searchUrl += encodeURIComponent(searchQuery);

  // Add parameters
  searchUrl += `&num=${Math.min(numResults, 100)}`;
  searchUrl += `&hl=${region}`;

  if (safeSearch) {
    searchUrl += '&safe=active';
  }

  // Add time range parameter
  if (timeRange !== 'any') {
    const timeParams: Record<string, string> = {
      day: 'd',
      week: 'w',
      month: 'm',
      year: 'y',
    };
    if (timeParams[timeRange]) {
      searchUrl += `&tbs=qdr:${timeParams[timeRange]}`;
    }
  }

  // Add result type parameter
  if (type !== 'web') {
    const typeParams: Record<string, string> = {
      news: 'nws',
      image: 'isch',
      video: 'vid',
    };
    if (typeParams[type]) {
      searchUrl += `&tbm=${typeParams[type]}`;
    }
  }

  try {
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerioLoad(response.data);
    const results: SearchResult[] = [];

    // Parse search results - this is prone to breaking if Google changes their HTML structure
    $('#search .g').each((index, element) => {
      if (index >= numResults) return;

      const titleElement = $(element).find('h3');
      const linkElement = $(element).find('a');
      const snippetElement = $(element).find('.VwiC3b');

      const title = titleElement.text().trim();
      const url = $(linkElement).attr('href') || '';
      const snippet = snippetElement.text().trim();

      if (title && url.startsWith('http')) {
        results.push({
          title,
          url,
          snippet,
          position: index + 1,
          source: 'google',
          type: type as 'web' | 'news' | 'image' | 'video',
        });
      }
    });

    // Extract related queries
    const relatedQueries: string[] = [];
    $('.related-question-pair').each((_, element) => {
      relatedQueries.push($(element).text().trim());
    });

    return {
      query,
      results,
      totalResults: results.length,
      searchTime: 0, // This will be set later
      relatedQueries: relatedQueries.length > 0 ? relatedQueries : undefined,
    };
  } catch (error) {
    throw new Error(
      `Google search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function searchDuckDuckGo(
  query: string,
  numResults: number,
  safeSearch: boolean,
  region: string,
  type: string,
  site?: string
): Promise<WebSearchResponse> {
  let searchUrl = 'https://duckduckgo.com/html/?q=';

  // Construct search query with site parameter if provided
  let searchQuery = query;
  if (site) {
    searchQuery = `${searchQuery} site:${site}`;
  }

  searchUrl += encodeURIComponent(searchQuery);

  // Add parameters
  searchUrl += `&kl=${region}`;

  if (safeSearch) {
    searchUrl += '&kp=1';
  } else {
    searchUrl += '&kp=-2';
  }

  try {
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerioLoad(response.data);
    const results: SearchResult[] = [];

    // Parse search results
    $('.result').each((index, element) => {
      if (index >= numResults) return;

      const titleElement = $(element).find('.result__title');
      // const linkElement = $(element).find('.result__url');
      const snippetElement = $(element).find('.result__snippet');

      const title = titleElement.text().trim();
      const url = $(titleElement).find('a').attr('href') || '';
      // const displayUrl = linkElement.text().trim();
      const snippet = snippetElement.text().trim();

      if (title && url) {
        results.push({
          title,
          url,
          snippet,
          position: index + 1,
          source: 'duckduckgo',
          type: type as 'web' | 'news' | 'image' | 'video',
        });
      }
    });

    return {
      query,
      results,
      totalResults: results.length,
      searchTime: 0, // This will be set later
    };
  } catch (error) {
    throw new Error(
      `DuckDuckGo search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function searchBing(
  query: string,
  numResults: number,
  safeSearch: boolean,
  timeRange: string,
  region: string,
  type: string,
  site?: string
): Promise<WebSearchResponse> {
  let searchUrl = 'https://www.bing.com/search?q=';

  // Construct search query with site parameter if provided
  let searchQuery = query;
  if (site) {
    searchQuery = `${searchQuery} site:${site}`;
  }

  searchUrl += encodeURIComponent(searchQuery);

  // Add parameters
  searchUrl += `&count=${Math.min(numResults, 50)}`;
  searchUrl += `&cc=${region}`;

  if (safeSearch) {
    searchUrl += '&safeSearch=strict';
  } else {
    searchUrl += '&safeSearch=off';
  }

  // Add time range parameter
  if (timeRange !== 'any') {
    const timeParams: Record<string, string> = {
      day: 'd',
      week: 'w',
      month: 'm',
      year: 'y',
    };
    if (timeParams[timeRange]) {
      searchUrl += `&filters=ex1:"ez${timeParams[timeRange]}"`;
    }
  }

  try {
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerioLoad(response.data);
    const results: SearchResult[] = [];

    // Parse search results
    $('.b_algo').each((index, element) => {
      if (index >= numResults) return;

      const titleElement = $(element).find('h2');
      // const linkElement = $(element).find('cite');
      const snippetElement = $(element).find('.b_caption p');

      const title = titleElement.text().trim();
      const url = titleElement.find('a').attr('href') || '';
      // const displayUrl = linkElement.text().trim();
      const snippet = snippetElement.text().trim();

      if (title && url.startsWith('http')) {
        results.push({
          title,
          url,
          snippet,
          position: index + 1,
          source: 'bing',
          type: type as 'web' | 'news' | 'image' | 'video',
        });
      }
    });

    // Extract related queries
    const relatedQueries: string[] = [];
    $('.b_rs li').each((_, element) => {
      relatedQueries.push($(element).text().trim());
    });

    return {
      query,
      results,
      totalResults: results.length,
      searchTime: 0, // This will be set later
      relatedQueries: relatedQueries.length > 0 ? relatedQueries : undefined,
    };
  } catch (error) {
    throw new Error(
      `Bing search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    const $ = cheerioLoad(response.data);

    // Remove script tags, style tags, and other non-content elements
    $('script, style, iframe, nav, footer, header, aside, .ads, .banner, .cookie-notice').remove();

    // Extract text from main content areas
    let content = '';

    // Try to find the main content element
    const mainSelectors = ['main', 'article', '.content', '.main-content', '#content', '#main'];
    let mainContent = '';

    for (const selector of mainSelectors) {
      if ($(selector).length) {
        mainContent = $(selector).text().trim();
        break;
      }
    }

    // If we found main content, use that, otherwise use body
    if (mainContent) {
      content = mainContent;
    } else {
      content = $('body').text().trim();
    }

    // Clean up the content
    content = content.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();

    return content;
  } catch (error) {
    throw new Error(
      `Failed to fetch page content: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export const WikipediaSearchTool = new DynamicStructuredTool({
  name: 'wikipedia-search',
  description: 'Search Wikipedia for information about a topic',
  schema: z.object({
    query: z.string().min(2).max(100).describe('The search query or topic'),
    language: z.string().min(2).max(2).describe('Wikipedia language code (e.g., "en", "es", "fr")'),
    limit: z.number().min(1).max(100).describe('Maximum number of results to return'),
    fetchFullArticle: z
      .boolean()
      .describe('Fetch and include the full content of the first matching article'),
  }),

  func: async (params: Record<string, unknown>) => {
    const { query, language = 'en', limit = 5, fetchFullArticle = false } = params;

    if (typeof query !== 'string' || query.trim() === '') {
      return {
        success: false,
        data: undefined,
        error: 'Query parameter must be a non-empty string',
      };
    }

    try {
      const searchUrl = `https://${language}.wikipedia.org/w/api.php`;

      // First, search for matching articles
      const searchResponse = await axios.get(searchUrl, {
        params: {
          action: 'query',
          list: 'search',
          srsearch: query,
          format: 'json',
          srlimit: limit,
          srinfo: 'suggestion',
          srprop: 'snippet|titlesnippet|sectiontitle',
        },
        timeout: 10000,
      });

      const searchData = searchResponse.data;
      const searchResults = searchData.query.search || [];

      if (searchResults.length === 0) {
        return {
          success: true,
          data: {
            query,
            results: [],
            suggestion: searchData.query?.searchinfo?.suggestion || null,
          },
        };
      }

      const results = searchResults.map((result: any) => ({
        title: result.title,
        snippet: cleanWikipediaSnippet(result.snippet),
        pageId: result.pageid,
      }));

      const response: Record<string, any> = {
        query,
        results,
        suggestion: searchData.query?.searchinfo?.suggestion || null,
      };

      // If requested, fetch the full content of the first article
      if (fetchFullArticle && results.length > 0) {
        try {
          const pageId = results[0].pageId;

          const contentResponse = await axios.get(searchUrl, {
            params: {
              action: 'query',
              prop: 'extracts|info|categories',
              exintro: 1,
              explaintext: 1,
              pageids: pageId,
              inprop: 'url',
              format: 'json',
            },
            timeout: 10000,
          });

          const page = contentResponse.data.query.pages[pageId];

          if (page) {
            response.fullArticle = {
              title: page.title,
              extract: page.extract,
              url: page.fullurl,
              categories:
                page.categories?.map((cat: any) => cat.title.replace('Category:', '')) || [],
            };
          }
        } catch (error) {
          response.fullArticleError = `Failed to fetch article content: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }

      return { success: true, data: response };
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: `Wikipedia search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
function cleanWikipediaSnippet(snippet: string): string {
  // Remove HTML tags
  return snippet
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
