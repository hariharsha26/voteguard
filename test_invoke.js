import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tfmzaostvnuopntlebjv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmbXphb3N0dm51b3BudGxlYmp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NjQzNzQsImV4cCI6MjA5NjA0MDM3NH0.PWTt_0JjCh0y5yeuOT5zbreYLLN3Kol4pqF0KWGtLQs'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data, error } = await supabase.functions.invoke('send-otp')
  console.log("Data:", data)
  console.log("Error object:", error)
  if (error) {
    console.log("Error name:", error.name)
    console.log("Error message:", error.message)
    console.log("Error context:", error.context)
    if (error.context && typeof error.context.json === 'function') {
      try {
        const json = await error.context.json()
        console.log("Context JSON:", json)
      } catch(e) {
        console.log("Could not parse context as json", e)
      }
    }
  }
}

test()
