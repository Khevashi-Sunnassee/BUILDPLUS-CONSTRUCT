import logger from "../lib/logger";
import { InsertReoScheduleItem } from "@shared/schema";

export interface ReoExtractionResult {
  success: boolean;
  items: Omit<InsertReoScheduleItem, "scheduleId">[];
  rawResponse?: string;
  modelUsed: string;
  error?: string;
}

const REO_EXTRACTION_PROMPT = `You are a technical document analyzer specializing in precast concrete reinforcement (reo) schedules.
Analyze the provided panel shop drawing/IFC document and extract all reinforcement (reo/rebar) items.

For each reinforcement item, extract:
- reoType: Type of reo (e.g., "VERTICAL_REO", "HORIZONTAL_REO", "MESH", "FITMENT", "U_BAR", "LIG", "BLOCKOUT_BAR", "ADDITIONAL_REO", "DOWEL_BAR", "PLATE", "INSERT", "LIFTER")
- barSize: Bar size (e.g., "N12", "N16", "N20", "N24", "SL82", "SL92")
- barShape: Shape code if applicable (e.g., "L1", "R1", "straight")
- length: Length in mm (as a number)
- quantity: Number of bars/items (as an integer)
- weight: Total weight in kg for this line item (as a number, or null if not calculable)
- spacing: Spacing if applicable (e.g., "200 c/c", "300 max")
- zone: Zone or location in panel (e.g., "TOP", "BOTTOM", "EDGE", "OPENING")
- description: Brief description of the item

Return a JSON object with this structure:
{
  "items": [
    {
      "reoType": "VERTICAL_REO",
      "barSize": "N16",
      "barShape": "straight",
      "length": 3200,
      "quantity": 8,
      "weight": 25.6,
      "spacing": "200 c/c",
      "zone": "FACE A",
      "description": "Vertical reinforcement bars"
    }
  ]
}

Extract ALL reinforcement items visible in the document including:
- Main reinforcement bars (vertical and horizontal)
- Mesh/SL reinforcement
- Edge bars and U-bars
- Fitments and ligs
- Blockout reinforcement
- Lifters and inserts
- Dowel bars and starter bars
- Plates and special items

If a value cannot be determined, use null for that field.
Return ONLY valid JSON, no explanation text.`;

export async function extractReoFromPdf(pdfBase64: string, panelMark: string): Promise<ReoExtractionResult> {
  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    const modelUsed = "gpt-5.2";

    const response = await openai.chat.completions.create({
      model: modelUsed,
      messages: [
        {
          role: "system",
          content: REO_EXTRACTION_PROMPT
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this precast panel IFC shop drawing and extract all reinforcement (reo) items. Panel Mark: ${panelMark}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_completion_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    
    let parsedData: { items: any[] };
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanContent);
    } catch (e) {
      logger.error({ err: e }, "Failed to parse OpenAI reo extraction response");
      return {
        success: false,
        items: [],
        rawResponse: content,
        modelUsed,
        error: "Failed to parse AI response as JSON"
      };
    }

    if (!parsedData.items || !Array.isArray(parsedData.items)) {
      return {
        success: false,
        items: [],
        rawResponse: content,
        modelUsed,
        error: "AI response did not contain valid items array"
      };
    }

    const items: Omit<InsertReoScheduleItem, "scheduleId">[] = parsedData.items.map((item: any, index: number) => ({
      reoType: String(item.reoType || "UNKNOWN"),
      barSize: item.barSize ? String(item.barSize) : null,
      barShape: item.barShape ? String(item.barShape) : null,
      length: item.length ? String(item.length) : null,
      quantity: parseInt(String(item.quantity || 1), 10),
      weight: item.weight ? String(item.weight) : null,
      spacing: item.spacing ? String(item.spacing) : null,
      zone: item.zone ? String(item.zone) : null,
      description: item.description ? String(item.description) : null,
      notes: null,
      status: "PENDING" as const,
      purchaseOrderId: null,
      purchaseOrderItemId: null,
      sortOrder: index,
    }));

    logger.info({ panelMark, itemCount: items.length }, "Successfully extracted reo items from PDF");

    return {
      success: true,
      items,
      rawResponse: content,
      modelUsed,
    };
  } catch (error: any) {
    logger.error({ err: error, panelMark }, "Error extracting reo from PDF");
    return {
      success: false,
      items: [],
      modelUsed: "gpt-5.2",
      error: error.message || "Unknown error during AI processing"
    };
  }
}
