import axios from 'axios';
import { load as cheerioLoad } from 'cheerio';
import { BaseTool } from './base-tool.js';
import { ToolResult } from '../types/index.js';

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

export class WebSearchTool extends BaseTool {
  name = 'web-search';
  description = 'Search the web for information using various search engines';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query'
      },
      engine: {
        type: 'string',
        enum: ['google', 'duckduckgo', 'bing'],
        description: 'Search engine to use',
        default: 'google'
      },
      numResults: {
        type: 'number',
        description: 'Number of results to return',
        default: 10
      },
      safeSearch: {
        type: 'boolean',
        description: 'Enable safe search filtering',
        default: true
      },
      timeRange: {
        type: 'string',
        enum: ['any', 'day', 'week', 'month', 'year'],
        description: 'Time range for results',
        default: 'any'
      },
      region: {
        type: 'string',
        description: 'Region/country code for localized results (e.g., "us", "uk", "de")',
        default: 'us'
      },
      type: {
        type: 'string',
        enum: ['web', 'news', 'image', 'video'],
        description: 'Type of search results to return',
        default: 'web'
      },
      site: {
        type: 'string',
        description: 'Limit search to specific website domain (e.g., "example.com")'
      },
      fetchFullContent: {
        type: 'boolean',
        description: 'Fetch and include full content of the first result',
        default: false
      }
    },
    required: ['query']
  };

  private USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
  }

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const {
      query,
      engine = 'google',
      numResults = 2,
      safeSearch = true,
      timeRange = 'any',
      region = 'us',
      type = 'web',
      site,
      fetchFullContent = false
    } = params;

    if (typeof query !== 'string' || query.trim() === '') {
      return this.createResult(false, undefined, 'Query parameter must be a non-empty string');
    }

    try {
      const startTime = Date.now();
      let searchResults: WebSearchResponse;

      switch (engine) {
        case 'google':
          searchResults = await this.searchGoogle(
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
          searchResults = await this.searchDuckDuckGo(
            query as string,
            numResults as number,
            safeSearch as boolean,
            region as string,
            type as string,
            site as string
          );
          break;
        case 'bing':
          searchResults = await this.searchBing(
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
          return this.createResult(false, undefined, `Unsupported search engine: ${engine}`);
      }

      searchResults.searchTime = Date.now() - startTime;

      // Fetch full content of the first result if requested
      if (fetchFullContent && searchResults.results.length > 0) {
        try {
          const firstResult = searchResults.results[0];
          const fullContent = await this.fetchPageContent(firstResult.url);
          
          return this.createResult(true, {
            ...searchResults,
            fullContent: {
              url: firstResult.url,
              title: firstResult.title,
              content: fullContent
            }
          });
        } catch (error) {
          // If fetching full content fails, return just the search results
          return this.createResult(true, searchResults, undefined, {
            fullContentError: `Failed to fetch full content: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      return this.createResult(true, searchResults);
    } catch (error) {
      return this.createResult(
        false,
        undefined,
        `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async searchGoogle(
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
        year: 'y'
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
        video: 'vid'
      };
      if (typeParams[type]) {
        searchUrl += `&tbm=${typeParams[type]}`;
      }
    }

    try {
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
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
            type: type as 'web' | 'news' | 'image' | 'video'
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
        relatedQueries: relatedQueries.length > 0 ? relatedQueries : undefined
      };
    } catch (error) {
      throw new Error(`Google search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async searchDuckDuckGo(
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
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
      });

      const $ = cheerioLoad(response.data);
      const results: SearchResult[] = [];

      // Parse search results
      $('.result').each((index, element) => {
        if (index >= numResults) return;
        
        const titleElement = $(element).find('.result__title');
        const linkElement = $(element).find('.result__url');
        const snippetElement = $(element).find('.result__snippet');
        
        const title = titleElement.text().trim();
        const url = $(titleElement).find('a').attr('href') || '';
        const displayUrl = linkElement.text().trim();
        const snippet = snippetElement.text().trim();
        
        if (title && url) {
          results.push({
            title,
            url,
            snippet,
            position: index + 1,
            source: 'duckduckgo',
            type: type as 'web' | 'news' | 'image' | 'video'
          });
        }
      });

      return {
        query,
        results,
        totalResults: results.length,
        searchTime: 0 // This will be set later
      };
    } catch (error) {
      throw new Error(`DuckDuckGo search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async searchBing(
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
        year: 'y'
      };
      if (timeParams[timeRange]) {
        searchUrl += `&filters=ex1:"ez${timeParams[timeRange]}"`;
      }
    }

    try {
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
      });

      const $ = cheerioLoad(response.data);
      const results: SearchResult[] = [];

      // Parse search results
      $('.b_algo').each((index, element) => {
        if (index >= numResults) return;
        
        const titleElement = $(element).find('h2');
        const linkElement = $(element).find('cite');
        const snippetElement = $(element).find('.b_caption p');
        
        const title = titleElement.text().trim();
        const url = titleElement.find('a').attr('href') || '';
        const displayUrl = linkElement.text().trim();
        const snippet = snippetElement.text().trim();
        
        if (title && url.startsWith('http')) {
          results.push({
            title,
            url,
            snippet,
            position: index + 1,
            source: 'bing',
            type: type as 'web' | 'news' | 'image' | 'video'
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
        relatedQueries: relatedQueries.length > 0 ? relatedQueries : undefined
      };
    } catch (error) {
      throw new Error(`Bing search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000,
        maxRedirects: 5
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
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
      
      return content;
    } catch (error) {
      throw new Error(`Failed to fetch page content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export class WikipediaSearchTool extends BaseTool {
  name = 'wikipedia-search';
  description = 'Search Wikipedia for information about a topic';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query or topic'
      },
      language: {
        type: 'string',
        description: 'Wikipedia language code (e.g., "en", "es", "fr")',
        default: 'en'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 5
      },
      fetchFullArticle: {
        type: 'boolean',
        description: 'Fetch and include the full content of the first matching article',
        default: false
      }
    },
    required: ['query']
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const {
      query,
      language = 'en',
      limit = 5,
      fetchFullArticle = false
    } = params;

    if (typeof query !== 'string' || query.trim() === '') {
      return this.createResult(false, undefined, 'Query parameter must be a non-empty string');
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
          srprop: 'snippet|titlesnippet|sectiontitle'
        },
        timeout: 10000
      });

      const searchData = searchResponse.data;
      const searchResults = searchData.query.search || [];
      
      if (searchResults.length === 0) {
        return this.createResult(true, {
          query,
          results: [],
          suggestion: searchData.query?.searchinfo?.suggestion || null
        });
      }

      const results = searchResults.map((result: any) => ({
        title: result.title,
        snippet: this.cleanWikipediaSnippet(result.snippet),
        pageId: result.pageid
      }));

      const response: Record<string, any> = {
        query,
        results,
        suggestion: searchData.query?.searchinfo?.suggestion || null
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
              format: 'json'
            },
            timeout: 10000
          });

          const page = contentResponse.data.query.pages[pageId];
          
          if (page) {
            response.fullArticle = {
              title: page.title,
              extract: page.extract,
              url: page.fullurl,
              categories: page.categories?.map((cat: any) => cat.title.replace('Category:', '')) || []
            };
          }
        } catch (error) {
          response.fullArticleError = `Failed to fetch article content: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }

      return this.createResult(true, response);
    } catch (error) {
      return this.createResult(
        false,
        undefined,
        `Wikipedia search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private cleanWikipediaSnippet(snippet: string): string {
    // Remove HTML tags
    return snippet
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}