import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, User, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminApi } from "@/lib/admin/adminApi";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchResult {
  type: 'organization' | 'user';
  id: string;
  title: string;
  subtitle: string;
}

export function AdminGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const navigate = useNavigate();

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const [orgsResponse, usersResponse] = await Promise.all([
        adminApi.organizations.list({ search: searchQuery, page: 1, pageSize: 5 }),
        adminApi.users.list({ search: searchQuery, page: 1, pageSize: 5 }),
      ]);

      const orgResults: SearchResult[] = (orgsResponse.organizations || []).map((org) => ({
        type: 'organization' as const,
        id: org.id,
        title: org.business_name,
        subtitle: org.slug || org.contact_email || 'Organization',
      }));

      const userResults: SearchResult[] = (usersResponse.users || []).map((user) => ({
        type: 'user' as const,
        id: user.user_id,
        title: user.organizations?.[0]?.organization_name || user.user_id,
        subtitle: user.role || 'User',
      }));

      setResults([...orgResults, ...userResults]);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    
    if (result.type === 'organization') {
      navigate(`/internal/organizations?highlight=${result.id}`);
    } else {
      navigate(`/internal/users?highlight=${result.id}`);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2 text-muted-foreground"
        data-testid="button-global-search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="sr-only">Search</DialogTitle>
          </DialogHeader>
          
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations, users..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-9"
                autoFocus
                data-testid="input-global-search"
              />
              {query && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setQuery("")}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto border-t">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted transition-colors"
                    onClick={() => handleSelect(result)}
                    data-testid={`search-result-${result.type}-${result.id}`}
                  >
                    <div className="flex-shrink-0">
                      {result.type === 'organization' ? (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : query ? (
              <div className="py-8 text-center text-muted-foreground">
                No results found for "{query}"
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Start typing to search...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
