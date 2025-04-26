"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { CalendarIcon, Filter, Search, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { SearchBar } from "@/components/search-bar"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { fetchAuthenticated } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

// Define types
interface MoodType {
  _id: string
  name: string
  emoji: string
  colorCode?: string
}

interface Entry {
  _id: string
  title: string
  content: string
  category: string
  createdAt: string
  mood?: {
    _id: string
    moodType: MoodType
  }
}

// Categories based on backend enum
const categories = [
  { id: "FAMILY", name: "Family" },
  { id: "RELATIONSHIP", name: "Relationship" },
  { id: "MYSELF", name: "Myself" },
  { id: "WORK", name: "Work" },
  { id: "OTHER", name: "Other" },
]

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // State for search query and filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMoodIds, setSelectedMoodIds] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: undefined,
    to: undefined,
  })

  // State for fetched data and loading
  const [filteredEntries, setFilteredEntries] = useState<Entry[]>([])
  const [moodTypes, setMoodTypes] = useState<MoodType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMoods, setIsLoadingMoods] = useState(true)

  // Fetch mood types for filter options
  useEffect(() => {
    const fetchMoodTypes = async () => {
      setIsLoadingMoods(true)
      try {
        const response = await fetchAuthenticated<{ moodTypes: MoodType[] }>("/api/v1/moods/types")
        if (response.status === "success" && response.data?.moodTypes) {
          setMoodTypes(response.data.moodTypes)
        } else {
          toast({ variant: "destructive", title: "Error", description: "Could not fetch mood types for filtering." })
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch mood types." })
         if (error.message.includes("Session expired")) {
           router.push("/login")
        }
      } finally {
        setIsLoadingMoods(false)
      }
    }
    fetchMoodTypes()
  }, [toast, router])

  // Fetch search results when filters or query change
  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      const params = new URLSearchParams();

      // Build query parameters based on state
      if (searchQuery) params.set('query', searchQuery);
      if (selectedCategories.length > 0) params.set('categories', selectedCategories.join(','));
      if (selectedMoodIds.length > 0) params.set('moods', selectedMoodIds.join(','));
      if (dateRange.from) params.set('fromDate', format(dateRange.from, 'yyyy-MM-dd'));
      if (dateRange.to) params.set('toDate', format(dateRange.to, 'yyyy-MM-dd'));
      // Add pagination params if needed, e.g., params.set('page', '1'); params.set('limit', '20');

      try {
        // Fetch data using the constructed URL
        const response = await fetchAuthenticated<{ entries: Entry[] }>(`/api/v1/search?${params.toString()}`);
        if (response.status === "success" && response.data?.entries) {
          setFilteredEntries(response.data.entries);
        } else {
          toast({ variant: "destructive", title: "Error", description: response.message || "Could not fetch search results." });
          setFilteredEntries([]); // Clear results on error
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch search results." });
        setFilteredEntries([]); // Clear results on error
        if (error.message.includes("Session expired")) {
          router.push("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce search fetch slightly to avoid excessive calls while typing/filtering
    const debounceTimer = setTimeout(() => {
        fetchResults();
    }, 300); // Adjust debounce time as needed (e.g., 500ms)

    return () => clearTimeout(debounceTimer); // Cleanup timer

  }, [searchQuery, selectedCategories, selectedMoodIds, dateRange, toast, router]); // Dependencies trigger re-fetch


  const handleSearch = (query: string) => {
    setSearchQuery(query)
    // Update URL query param without full page reload
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (!query) {
      current.delete("q");
    } else {
      current.set("q", query);
    }
    const search = current.toString();
    const queryStr = search ? `?${search}` : "";
    router.push(`${window.location.pathname}${queryStr}`, { scroll: false });
  }

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    )
  }

  const handleMoodToggle = (moodId: string) => {
    setSelectedMoodIds((prev) => (prev.includes(moodId) ? prev.filter((id) => id !== moodId) : [...prev, moodId]))
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedMoodIds([])
    setDateRange({ from: undefined, to: undefined })
    // Optionally clear search query as well
    // setSearchQuery("");
    // Optionally update URL
    // router.push('/dashboard/search', { scroll: false });
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (selectedCategories.length > 0) count++
    if (selectedMoodIds.length > 0) count++
    if (dateRange.from || dateRange.to) count++
    return count
  }

  // Function to apply filters (called from Sheet close or button)
  const applyFiltersAndSearch = () => {
     // This function is less critical now as useEffect handles fetching
     console.log("Applying filters (search triggered by useEffect)...");
     // The SheetClose component will close the sheet
  }

  // Type guard for DateRange
  const isDateRange = (value: any): value is { from?: Date; to?: Date } => {
    return typeof value === 'object' && value !== null && ('from' in value || 'to' in value);
  }

  // Correctly handle the type from react-day-picker's onSelect for range mode
  const handleDateRangeSelect = (range: import("react-day-picker").DateRange | undefined) => {
     setDateRange({
        from: range?.from,
        to: range?.to,
     });
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Search Entries</h1>
          <p className="text-muted-foreground">Find your past thoughts and reflections</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Pass current searchQuery to SearchBar if it accepts a value prop */}
        <SearchBar onSearch={handleSearch} placeholder="Search by keyword, title, or content..." />

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filter Entries</SheetTitle>
              <SheetDescription>Narrow down your search results</SheetDescription>
            </SheetHeader>
            <div className="grid gap-6 py-6">
              {/* Category Filters */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Categories</h3>
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                      />
                      <Label htmlFor={`category-${category.id}`}>{category.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              {/* Mood Filters */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Moods</h3>
                <div className="grid grid-cols-2 gap-3">
                  {isLoadingMoods ? (
                     <> {/* Add Skeleton loaders for moods */}
                       <div className="flex items-center space-x-2"><Skeleton className="h-4 w-4" /><Skeleton className="h-4 w-20" /></div>
                       <div className="flex items-center space-x-2"><Skeleton className="h-4 w-4" /><Skeleton className="h-4 w-16" /></div>
                       <div className="flex items-center space-x-2"><Skeleton className="h-4 w-4" /><Skeleton className="h-4 w-24" /></div>
                       <div className="flex items-center space-x-2"><Skeleton className="h-4 w-4" /><Skeleton className="h-4 w-18" /></div>
                     </>
                  ) : (
                    moodTypes.map((mood) => (
                      <div key={mood._id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`mood-${mood._id}`}
                          checked={selectedMoodIds.includes(mood._id)}
                          onCheckedChange={() => handleMoodToggle(mood._id)}
                        />
                        <Label htmlFor={`mood-${mood._id}`} className="flex items-center">
                          <span className="mr-1">{mood.emoji}</span> {mood.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {/* Date Range Filter */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Date Range</h3>
                <div className="grid gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Select date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="range" selected={dateRange} onSelect={handleDateRangeSelect} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </SheetClose>
              {/* Apply button now just closes the sheet */}
              <SheetClose asChild>
                 <Button onClick={applyFiltersAndSearch}>Apply Filters</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Display Active Filters */}
      {(selectedCategories.length > 0 || selectedMoodIds.length > 0 || dateRange.from || dateRange.to) && (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.map((categoryId) => (
            <Badge key={categoryId} variant="secondary" className="flex items-center gap-1">
              {categories.find((c) => c.id === categoryId)?.name}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleCategoryToggle(categoryId)}
              >
                <span className="sr-only">Remove</span>
                &times;
              </Button>
            </Badge>
          ))}
          {selectedMoodIds.map((moodId) => {
            const mood = moodTypes.find((m) => m._id === moodId);
            return mood ? (
              <Badge key={moodId} variant="secondary" className="flex items-center gap-1">
                <span className="mr-1">{mood.emoji}</span>
                {mood.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => handleMoodToggle(moodId)}
                >
                  <span className="sr-only">Remove</span>
                  &times;
                </Button>
              </Badge>
            ) : null;
          })}
          {(dateRange.from || dateRange.to) && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {dateRange.from
                ? dateRange.to
                  ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                  : `From ${format(dateRange.from, "MMM d")}`
                : `Until ${format(dateRange.to!, "MMM d")}`}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => setDateRange({ from: undefined, to: undefined })}
              >
                <span className="sr-only">Remove</span>
                &times;
              </Button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6">
            Clear all
          </Button>
        </div>
      )}

      {/* Search Results Area */}
      <div className="mt-6">
        <h2 className="mb-4 text-xl font-semibold">
          {searchQuery ? `Results for "${searchQuery}"` : "All Entries"}
          {/* Display count after loading */}
          {!isLoading && (
             <span className="ml-2 text-sm font-normal text-muted-foreground">
               ({filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"})
             </span>
          )}
        </h2>

        {isLoading ? (
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             {/* Skeleton loaders for entries */}
             {Array.from({ length: 6 }).map((_, index) => (
               <Card key={index}>
                 <CardHeader className="pb-2">
                   <Skeleton className="h-6 w-3/4 mb-1" />
                   <Skeleton className="h-4 w-1/2" />
                 </CardHeader>
                 <CardContent>
                   <Skeleton className="h-4 w-1/4 mb-2" />
                   <Skeleton className="h-16 w-full" />
                 </CardContent>
                 <CardFooter>
                   <Skeleton className="h-8 w-full" />
                 </CardFooter>
               </Card>
             ))}
           </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <Search className="mb-2 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium">No entries found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Map over fetched entries */}
            {filteredEntries.map((entry) => (
              <Card key={entry._id}> {/* Use _id */}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl" title={entry.mood?.moodType?.name}>
                          {entry.mood?.moodType?.emoji || '❓'}
                        </span>
                        <CardTitle className="text-lg">{entry.title}</CardTitle>
                      </div>
                      <CardDescription>{format(new Date(entry.createdAt), "MMMM d, yyyy")}</CardDescription> {/* Use createdAt */}
                    </div>
                    {/* Add Edit button if needed */}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {categories.find((c) => c.id === entry.category)?.name}
                    </span>
                    {/* Add mood badge if needed */}
                  </div>
                  <p className="line-clamp-4 text-sm text-muted-foreground">{entry.content}</p>
                </CardContent>
                <CardFooter>
                  {/* Link to view full entry or implement expand */}
                  <Button variant="ghost" className="w-full" size="sm">
                    Read More
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
