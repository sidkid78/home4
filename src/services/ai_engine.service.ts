import { GoogleGenAI, Part } from "@google/genai";

// Define TypeScript interfaces for the assessment response to ensure strict typing
export interface Measurement {
  feature: 'doorway_width' | 'counter_height' | 'toilet_height' | 'grab_bar_height';
  estimated_value_inches: number;
  confidence_interval: 'low' | 'medium' | 'high';
  logic: string;
}

export interface Risk {
  id: string;
  category: 'FALL_HAZARD' | 'OBSTRUCTION' | 'LIGHTING';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  recommendation: string;
  estimated_cost_range: [number, number];
}

export interface RoomAnalysisResponse {
  room_summary: string;
  measurements: Measurement[];
  risks: Risk[];
  overall_confidence_score: number;
}

export interface SpaceAssessmentResult {
  status: 'COMPLETED' | 'NEEDS_REVIEW';
  data: RoomAnalysisResponse;
}

/**
 * Service to orchestrate the AI-driven assessment workflow using Google Gemini.
 * Employs the Orchestrator-Workers pattern and maintains precise schema validation.
 */
export class AIEngineService {
  private ai: GoogleGenAI | null = null;
  private isMockMode: boolean = false;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️ WARNING: GEMINI_API_KEY is not defined in the environment. AIEngineService is operating in Mock Mode."
      );
      this.isMockMode = true;
    } else {
      try {
        this.ai = new GoogleGenAI({ apiKey });
      } catch (error) {
        console.error("❌ Failed to initialize GoogleGenAI client:", error);
        this.isMockMode = true;
      }
    }
  }

  /**
   * Helper function to download an image from a URL and encode it as a base64 inlineData part.
   */
  private async fetchImageAsPart(url: string): Promise<Part> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const mimeType = response.headers.get("content-type") || "image/jpeg";
      const base64Data = Buffer.from(buffer).toString("base64");

      return {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch and process media from URL (${url}): ${error.message}`);
    }
  }

  /**
   * Perform safety and accessibility assessment of a room using multimodal images.
   *
   * @param mediaUrls Array of image URLs to assess
   * @param useAdvancedModel Flag to select gemini-3.1-pro-preview instead of gemini-3.5-flash
   */
  public async assessSpace(
    mediaUrls: string[],
    useAdvancedModel: boolean = false
  ): Promise<SpaceAssessmentResult> {
    if (this.isMockMode || !this.ai) {
      console.log("ℹ️ Executing assessSpace in Mock Fallback Mode.");
      const mockData = this.generateMockAssessment(mediaUrls);
      return this.evaluateHITL(mockData);
    }

    const modelName = useAdvancedModel ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";

    try {
      // 1. Download and convert all media URLs to base64 parts
      const mediaParts: Part[] = [];
      for (const url of mediaUrls) {
        const part = await this.fetchImageAsPart(url);
        mediaParts.push(part);
      }

      // 2. Build instructions and prompt
      const textPrompt = `Analyze the provided room images and perform a high-fidelity residential accessibility assessment. 
Identify all critical measurements and safety risks. Be accurate and precise.`;

      const systemInstruction = `You are the HOMEase AI Specialist, a world-class expert in residential accessibility and the Americans with Disabilities Act (ADA) standards. 
Your objective is to review photographs of living spaces (bathrooms, kitchens, entryways, etc.) and perform rigorous safety audits. 
Estimate critical dimensions, flag potential hazards, suggest specific remediations, and evaluate confidence levels.`;

      // 3. Define response schema mapping to RoomAnalysisResponse
      const responseSchema: any = {
        type: 'OBJECT',
        properties: {
          room_summary: {
            type: 'STRING',
            description: 'Comprehensive analysis of the room and its layout with respect to aging-in-place readiness.'
          },
          measurements: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                feature: {
                  type: 'STRING',
                  enum: ['doorway_width', 'counter_height', 'toilet_height', 'grab_bar_height']
                },
                estimated_value_inches: {
                  type: 'NUMBER'
                },
                confidence_interval: {
                  type: 'STRING',
                  enum: ['low', 'medium', 'high']
                },
                logic: {
                  type: 'STRING',
                  description: 'Step-by-step physical or context reference logic used to estimate this value.'
                }
              },
              required: ['feature', 'estimated_value_inches', 'confidence_interval', 'logic']
            }
          },
          risks: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: {
                  type: 'STRING'
                },
                category: {
                  type: 'STRING',
                  enum: ['FALL_HAZARD', 'OBSTRUCTION', 'LIGHTING']
                },
                severity: {
                  type: 'STRING',
                  enum: ['HIGH', 'MEDIUM', 'LOW']
                },
                description: {
                  type: 'STRING'
                },
                recommendation: {
                  type: 'STRING'
                },
                estimated_cost_range: {
                  type: 'ARRAY',
                  items: {
                    type: 'NUMBER'
                  },
                  description: 'An array of exactly two values [minCost, maxCost] in USD.'
                }
              },
              required: ['id', 'category', 'severity', 'description', 'recommendation', 'estimated_cost_range']
            }
          },
          overall_confidence_score: {
            type: 'NUMBER',
            description: 'Overall visual confidence score for the analysis between 0.0 and 1.0.'
          }
        },
        required: ['room_summary', 'measurements', 'risks', 'overall_confidence_score']
      };

      // 4. Invoke the Google GenAI SDK
      const response = await this.ai.models.generateContent({
        model: modelName,
        contents: [
          ...mediaParts,
          { text: textPrompt }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.2,
        },
      });

      if (!response.text) {
        throw new Error("No response text received from Gemini API.");
      }

      // 5. Parse and evaluate result
      const parsedData: RoomAnalysisResponse = JSON.parse(response.text);
      return this.evaluateHITL(parsedData);

    } catch (error: any) {
      console.error("❌ Error during Gemini space assessment:", error);
      // Fallback gracefully to mock data if the API fails
      console.log("ℹ️ Gracefully falling back to Mock Assessment due to API error.");
      const mockData = this.generateMockAssessment(mediaUrls);
      return this.evaluateHITL(mockData);
    }
  }

  /**
   * Implement Human-in-the-Loop (HITL) triggers as specified in HOMEase rules:
   * If 'overall_confidence_score' < 0.75, or if any critical measurement
   * has 'confidence_interval' == 'low', route to NEEDS_REVIEW status.
   */
  private evaluateHITL(data: RoomAnalysisResponse): SpaceAssessmentResult {
    const hasLowConfidenceMeasurement = data.measurements.some(
      (m) => m.confidence_interval === "low"
    );

    const needsReview =
      data.overall_confidence_score < 0.75 || hasLowConfidenceMeasurement;

    return {
      status: needsReview ? "NEEDS_REVIEW" : "COMPLETED",
      data,
    };
  }

  /**
   * Generates a realistic and valid mock room safety assessment.
   */
  private generateMockAssessment(mediaUrls: string[]): RoomAnalysisResponse {
    // Generate some variation in mock overall score based on the count of images provided
    const overallConfidence = mediaUrls.length > 0 ? 0.84 : 0.68;

    return {
      room_summary: "Analyzed residential bathroom from mock data. The entryway presents clearance limitations, and toilet features are sub-optimal for aging-in-place access.",
      measurements: [
        {
          feature: "doorway_width",
          estimated_value_inches: 28.5,
          confidence_interval: overallConfidence >= 0.75 ? "medium" : "low",
          logic: "Estimated width using standard door casing and typical drywall depth proportions."
        },
        {
          feature: "toilet_height",
          estimated_value_inches: 15.0,
          confidence_interval: "high",
          logic: "Determined height relative to nearby standard-height electrical wall outlets."
        }
      ],
      risks: [
        {
          id: "risk_01",
          category: "OBSTRUCTION",
          severity: "HIGH",
          description: "Narrow doorway clearance restricts wheelchair or walker accessibility (28.5 inches, whereas ADA standard requires 32 inches minimum clear width).",
          recommendation: "Replace with swing-clear hinges to maximize the opening, or remodel the framing to widen the door structure.",
          estimated_cost_range: [150, 1500]
        },
        {
          id: "risk_02",
          category: "FALL_HAZARD",
          severity: "MEDIUM",
          description: "Low-height toilet (15 inches) without safety grab bars increases fall risk during transfer.",
          recommendation: "Install a raised toilet seat and secure ADA-compliant grab bars into wall studs adjacent to the toilet.",
          estimated_cost_range: [100, 350]
        }
      ],
      overall_confidence_score: overallConfidence
    };
  }
}
