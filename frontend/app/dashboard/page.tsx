"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { CalendarIcon, Pencil, Save, Search, Sparkles, Loader2, X } from "lucide-react" // Added Loader2 and X
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchBar } from "@/components/search-bar"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { fetchAuthenticated } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

// Define types for API data (adjust based on actual backend response)
// Type for fetched categories (assuming backend sends string array)
interface CategoryResponse {
  categories: string[];
}

// Type for formatted categories used in state/rendering
interface FormattedCategory {
  id: string;
  name: string;
}

interface User {
  _id: string
  name: string
  email: string
}

interface MoodType {
  _id: string
  name: string
  emoji: string
  colorCode?: string // Assuming backend provides this, adjust if needed
  color?: string // Frontend derived color class
}

interface Entry {
  _id: string
  title: string
  content: string
  category: string
  createdAt: string // Assuming ISO string date
  mood?: { // Mood might be populated
    _id: string
    moodType: MoodType // Nested mood type
  }
}

// REMOVED Hardcoded categories array

// Inspirational prompts for journal entries
const journalPrompts = [
  "What made you smile today?",
  "What's something you're grateful for right now?",
  "What's a challenge you're facing and how are you handling it?",
  "Describe a moment that brought you joy recently.",
  "What's something you're looking forward to?",
  "What's a lesson you learned this week?",
  "How are you taking care of yourself today?",
  "What's something you'd like to improve about yourself?",
  "Describe your ideal day. What would it look like?",
  "What's a goal you're working towards right now?",
]

// Helper to map backend mood color codes to Tailwind classes (example)
const getMoodColorClass = (colorCode?: string): string => {
  // Basic mapping, adjust as needed based on backend colorCode values
  switch (colorCode?.toLowerCase()) {
    case "#dcfce7": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"; // Example green
    case "#dbeafe": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"; // Example blue
    case "#e0e7ff": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"; // Example indigo
    case "#fee2e2": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"; // Example red
    case "#fef9c3": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"; // Example yellow
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"; // Default gray
  }
}


export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null) // Initialize as null, set after fetch
  const [entryContent, setEntryContent] = useState("")
  const [entryTitle, setEntryTitle] = useState("")
  const [activeTab, setActiveTab] = useState("new-entry")
  const [currentPrompt, setCurrentPrompt] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null) // Store selected mood type ID

  // State for fetched data
  const [userName, setUserName] = useState<string>("User") // Default name
  const [moodTypes, setMoodTypes] = useState<MoodType[]>([])
  const [recentEntries, setRecentEntries] = useState<Entry[]>([])

  // Loading states
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [isLoadingMoods, setIsLoadingMoods] = useState(true)
  const [isLoadingEntries, setIsLoadingEntries] = useState(true)
  const [entryCategories, setEntryCategories] = useState<FormattedCategory[]>([]); // State for fetched categories
  const [isLoadingCategories, setIsLoadingCategories] = useState(true); // Loading state for categories
  const [selectedEntryForModal, setSelectedEntryForModal] = useState<Entry | null>(null); // State for modal view

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoadingUser(true)
      try {
        const response = await fetchAuthenticated<{ user: User }>("/api/v1/auth/me")
        if (response.status === "success" && response.data?.user) {
          setUserName(response.data.user.name)
        } else {
          toast({ variant: "destructive", title: "Error", description: "Could not fetch user data." })
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch user data." })
        if (error.message.includes("Session expired")) {
           router.push("/login")
        }
      } finally {
        setIsLoadingUser(false)
      }
    }
    fetchUser()
  }, [toast, router]) // Add router to dependency array

  // Fetch mood types
  useEffect(() => {
    const fetchMoodTypes = async () => {
      setIsLoadingMoods(true)
      try {
        const response = await fetchAuthenticated<{ moodTypes: MoodType[] }>("/api/v1/moods/types")
        if (response.status === "success" && response.data?.moodTypes) {
          const moodsWithColor = response.data.moodTypes.map(mood => ({
            ...mood,
            color: getMoodColorClass(mood.colorCode)
          }));
          setMoodTypes(moodsWithColor)
          if (!selectedMoodId && moodsWithColor.length > 0) {
             const defaultMood = moodsWithColor.find(m => m.name.toLowerCase() === 'neutral') || moodsWithColor[0];
             setSelectedMoodId(defaultMood._id);
          }
        } else {
          toast({ variant: "destructive", title: "Error", description: "Could not fetch mood types." })
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
  }, [toast, router, selectedMoodId])

  // Fetch entry categories
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoadingCategories(true);
      try {
        // Fetch categories from the new endpoint
        const response = await fetchAuthenticated<CategoryResponse>("/api/v1/entries/categories");
        if (response.status === "success" && response.data?.categories) {
          // Format categories for display
          const formattedCategories = response.data.categories.map(cat => ({
            id: cat,
            name: cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase() // Simple title case
          }));
          setEntryCategories(formattedCategories);
          // Set default selected category *after* fetching, only if not already set
          if (formattedCategories.length > 0 && !selectedCategory) {
            setSelectedCategory(formattedCategories[0].id);
          }
        } else {
          toast({ variant: "destructive", title: "Error", description: "Could not fetch entry categories." });
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch entry categories." });
        if (error.message.includes("Session expired")) {
          router.push("/login");
        }
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
    // Depend on toast, router. selectedCategory is included to set default after fetch if needed.
  }, [toast, router, selectedCategory]);


  // Fetch recent entries
  const fetchRecentEntries = useCallback(async () => {
    setIsLoadingEntries(true)
    try {
      const response = await fetchAuthenticated<{ entries: Entry[] }>("/api/v1/entries?sort=-createdAt&limit=3")
      if (response.status === "success" && response.data?.entries) {
        setRecentEntries(response.data.entries)
      } else {
        toast({ variant: "destructive", title: "Error", description: "Could not fetch recent entries." })
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "API Error", description: error.message || "Failed to fetch recent entries." })
       if (error.message.includes("Session expired")) {
           router.push("/login")
        }
    } finally {
      setIsLoadingEntries(false)
    }
  }, [toast, router])

  useEffect(() => {
    fetchRecentEntries()
  }, [fetchRecentEntries])

  // Set a random prompt when the component mounts
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * journalPrompts.length)
    setCurrentPrompt(journalPrompts[randomIndex])
  }, [])


  const handleSave = async () => { // Make function async
    if (!entryTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please add a title for your journal entry.",
      })
      return
    }
     if (!selectedMoodId) { // Check if a mood is selected
       toast({
        variant: "destructive",
        title: "Mood required",
        description: "Please select your current mood.",
      })
      return;
    }

    setIsSaving(true)

    try {
      const payload = {
        title: entryTitle,
        content: entryContent,
        category: selectedCategory, // Use the uppercase ID from categories array
        moodTypeId: selectedMoodId, // Send the selected mood type ID
        entryDate: date?.toISOString() // Send date in ISO format, handle undefined case
      };

      // Use fetchAuthenticated to make the API call
      const response = await fetchAuthenticated("/api/v1/entries", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.status === "success") {
        toast({
          title: "Entry saved",
          description: "Your journal entry has been saved successfully.",
        });
        // Reset form
        setEntryTitle("");
        setEntryContent("");
        // Optionally reset date and mood, or keep them for next entry
        // setDate(new Date());
        // setSelectedMoodId(moodTypes.find(m => m.name.toLowerCase() === 'neutral')?._id || moodTypes[0]?._id || null);

        // Refresh recent entries and switch tab
        await fetchRecentEntries(); // Re-fetch entries after saving
        setActiveTab("recent-entries");
      } else {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: response.message || "Could not save entry. Please try again.",
        });
      }
    } catch (error: any) {
      console.error("Save entry error:", error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: error.message || "An unexpected error occurred.",
      });
       if (error.message.includes("Session expired")) {
           router.push("/login") // Redirect if session expired during save
        }
    } finally {
      setIsSaving(false);
    }
  }

  const handleSearch = (query: string) => {
    router.push(`/dashboard/search?q=${encodeURIComponent(query)}`)
  }

  const getNewPrompt = () => {
    let newPrompt = currentPrompt
    while (newPrompt === currentPrompt) {
      const randomIndex = Math.floor(Math.random() * journalPrompts.length)
      newPrompt = journalPrompts[randomIndex]
    }
    setCurrentPrompt(newPrompt)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          {isLoadingUser ? (
             <Skeleton className="h-9 w-48" />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight">Welcome, {userName}</h1>
          )}
          <p className="text-muted-foreground">How are you feeling today? Write it down and reflect.</p>
        </div>
        {/* Removed SearchBar and Date Picker Popover */}
      </div>

      <Tabs defaultValue="new-entry" className="space-y-4" onValueChange={setActiveTab} value={activeTab}>
        <TabsList>
          <TabsTrigger value="new-entry">New Entry</TabsTrigger>
          <TabsTrigger value="recent-entries">Recent Entries</TabsTrigger>
        </TabsList>
        <TabsContent value="new-entry" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Write a new entry</CardTitle>
              <CardDescription>Select a category and start writing your thoughts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               {/* Category Selection */}
               <div className="flex flex-wrap gap-2">
                 {isLoadingCategories ? (
                   <>
                     <Skeleton className="h-10 w-24 rounded-full" />
                     <Skeleton className="h-10 w-28 rounded-full" />
                     <Skeleton className="h-10 w-20 rounded-full" />
                   </>
                 ) : (
                   entryCategories.map((category) => ( // Use entryCategories state
                     <Button
                       key={category.id}
                       variant={selectedCategory === category.id ? "default" : "outline"}
                       onClick={() => setSelectedCategory(category.id)}
                       className="rounded-full"
                     >
                       {category.name}
                     </Button>
                   ))
                 )}
               </div>

              {/* Mood Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">How are you feeling today?</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                 {isLoadingMoods ? (
                    <>
                      <Skeleton className="h-10 w-24 rounded-full" />
                      <Skeleton className="h-10 w-20 rounded-full" />
                      <Skeleton className="h-10 w-28 rounded-full" />
                    </>
                  ) : (
                    moodTypes.map((mood) => (
                      <Button
                        key={mood._id} // Use _id from fetched data
                        variant="outline"
                        // Use mood.color derived in useEffect, and check against selectedMoodId
                        className={`h-10 px-3 ${selectedMoodId === mood._id ? mood.color : ""}`}
                        onClick={() => setSelectedMoodId(mood._id)} // Update selectedMoodId
                      >
                        <span className="mr-1 text-base">{mood.emoji}</span>
                        <span>{mood.name}</span>
                      </Button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <Input
                  placeholder="Entry title"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  className="mb-2"
                />
              </div>

              <div className="relative">
                <Textarea
                  placeholder={currentPrompt}
                  className="min-h-[200px]"
                  value={entryContent}
                  onChange={(e) => setEntryContent(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 text-xs flex items-center gap-1"
                  onClick={getNewPrompt}
                >
                  <Sparkles className="h-3 w-3" />
                  New prompt
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <p className="text-xs text-muted-foreground">
                {entryContent.length} {entryContent.length === 1 ? "character" : "characters"}
              </p>
              <Button onClick={handleSave} disabled={!entryContent.trim() || isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Entry"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="recent-entries" className="space-y-4">
          <div> {/* Removed flex justify-between */}
            <h2 className="text-xl font-semibold">Your Recent Entries</h2>
            {/* Removed Search All Entries Button Link */}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
           {isLoadingEntries ? (
              Array.from({ length: 3 }).map((_, index) => (
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
              ))
            ) : recentEntries.length === 0 ? (
               <p className="col-span-full text-center text-muted-foreground">No recent entries found.</p>
            ) : (
              recentEntries.map((entry) => (
                <Card key={entry._id} className="transition-all hover:shadow-md"> {/* Use _id */}
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {/* Access mood via entry.mood.moodType */}
                          <span className="text-xl" title={entry.mood?.moodType?.name}>
                            {entry.mood?.moodType?.emoji || '❓'} {/* Handle potentially undefined mood */}
                          </span>
                          <CardTitle className="text-lg">{entry.title}</CardTitle>
                        </div>
                        {/* Use createdAt for date */}
                        <CardDescription>{format(new Date(entry.createdAt), "MMMM d, yyyy")}</CardDescription>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                    </div>
                </CardHeader>
                <CardContent>
                  {/* Display Category Name in Recent Entry Card */}
                  <div className="mb-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {/* Find category name from fetched entryCategories */}
                      {entryCategories.find((c) => c.id === entry.category)?.name || entry.category}
                    </span>
                  </div>
                  {/* Always render truncated content in the card */}
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {entry.content}
                  </p>
                </CardContent>
                <CardFooter>
                  {/* Set entry for modal view on button click */}
                  <Button
                    variant="ghost"
                    className="w-full"
                    size="sm"
                    onClick={() => setSelectedEntryForModal(entry)} // Set the entry for modal view
                  >
                    Read More
                  </Button>
                </CardFooter>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Entry Detail Modal */}
      <Dialog open={!!selectedEntryForModal} onOpenChange={(isOpen) => !isOpen && setSelectedEntryForModal(null)}>
        <DialogContent className="sm:max-w-2xl"> {/* Make modal wider */}
          {selectedEntryForModal && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl" title={selectedEntryForModal.mood?.moodType?.name}>
                        {selectedEntryForModal.mood?.moodType?.emoji || '❓'}
                      </span>
                      <DialogTitle className="text-xl">{selectedEntryForModal.title}</DialogTitle>
                    </div>
                    <DialogDescription>
                      {format(new Date(selectedEntryForModal.createdAt), "MMMM d, yyyy")} - {" "}
                      {/* Display Category Name in Modal */}
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {/* Find category name from fetched entryCategories */}
                        {entryCategories.find((c) => c.id === selectedEntryForModal.category)?.name || selectedEntryForModal.category}
                      </span>
                    </DialogDescription>
                  </div>
                   <DialogClose asChild>
                      <Button variant="ghost" size="icon" className="ml-auto">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                      </Button>
                    </DialogClose>
                </div>
              </DialogHeader>
              <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto p-1 pr-4"> {/* Added padding and scroll */}
                {/* Render content preserving whitespace */}
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedEntryForModal.content}
                </p>
              </div>
              <DialogFooter className="sm:justify-start">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Back to Entries
                  </Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
