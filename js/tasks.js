/**
 * tasks.js
 * Sample evaluation tasks. Each task has a prompt and two AI responses to compare.
 * The responses were written for this demo; some contain deliberate mistakes
 * (factual errors, ignored instructions, bugs) so the rubric has something to catch.
 *
 * You can load your own tasks with the "Load tasks (JSON)" button using this same format.
 */

const SAMPLE_TASKS = [
  {
    id: "task-01",
    category: "Factual accuracy",
    prompt: "At what temperature does water boil at sea level, and how does altitude affect it?",
    responseA:
      "At sea level, water boils at 100 °C (212 °F).\n\nAt higher altitudes the air pressure is lower, so water boils at a lower temperature. For example, in a city at about 2,600 m above sea level, water boils at roughly 91 °C. This is why food can take longer to cook in the mountains.",
    responseB:
      "Water boils at 100 °C (212 °F) at sea level. At higher altitudes the air pressure is higher, so the boiling point increases and water needs more heat before it starts to boil.",
  },
  {
    id: "task-02",
    category: "Instruction following",
    prompt:
      "Summarize the following paragraph in exactly two sentences:\n\n\"Photosynthesis is the process plants use to turn light energy into chemical energy. Using sunlight, water and carbon dioxide, plants produce glucose, which they use for growth, and release oxygen as a by-product. This process takes place mainly in the leaves, inside structures called chloroplasts, and it is the basis of most food chains on Earth.\"",
    responseA:
      "Photosynthesis is how plants convert sunlight, water and carbon dioxide into glucose for growth, releasing oxygen as a by-product. It happens mainly in the chloroplasts of leaves and supports most food chains on Earth.",
    responseB:
      "Photosynthesis turns light energy into chemical energy. Plants use sunlight, water and carbon dioxide to make glucose. They release oxygen. It happens in the chloroplasts and supports most food chains.",
  },
  {
    id: "task-03",
    category: "Coding",
    prompt: "Write a Python function that returns the average of a list of numbers. It must handle an empty list without crashing.",
    responseA:
      "def average(numbers):\n    return sum(numbers) / len(numbers)\n\nThis function adds all the numbers and divides by how many there are.",
    responseB:
      "def average(numbers):\n    if not numbers:\n        return None\n    return sum(numbers) / len(numbers)\n\nIf the list is empty, the function returns None instead of raising a ZeroDivisionError. Otherwise, it divides the sum by the number of elements.",
  },
  {
    id: "task-04",
    category: "Math reasoning",
    prompt: "A shirt costs $40. It has a 25% discount, and then a 10% tax is applied to the discounted price. What is the final price?",
    responseA:
      "The discount is 25% and the tax is 10%, so the total change is −25% + 10% = −15%.\n\n$40 × 0.85 = $34.\n\nThe final price is $34.",
    responseB:
      "1. Discount: $40 × 0.25 = $10, so the discounted price is $40 − $10 = $30.\n2. Tax: $30 × 0.10 = $3.\n3. Final price: $30 + $3 = $33.\n\nThe final price is $33.",
  },
  {
    id: "task-05",
    category: "Writing & tone",
    prompt: "Write a short, polite email declining a meeting invitation for Friday afternoon.",
    responseA:
      "Subject: Friday meeting\n\nHi Ana,\n\nThank you for the invitation. Unfortunately, I won't be able to join the meeting on Friday afternoon because of a prior commitment. Would Monday morning or Tuesday afternoon work for you instead? I'm also happy to review any notes if the meeting goes ahead without me.\n\nBest regards,\nLaura",
    responseB: "Hi,\n\nI can't come on Friday.\n\nLaura",
  },
  {
    id: "task-06",
    category: "Translation (EN → ES)",
    prompt: "Translate into Spanish: \"The report is due next Monday, but we can ask for an extension if needed.\"",
    responseA: "El reporte es debido el próximo lunes, pero podemos preguntar por una extensión si necesario.",
    responseB: "El informe debe entregarse el próximo lunes, pero podemos pedir una prórroga si es necesario.",
  },
];
