import { db } from '../../db/sqlite';
import { v4 as uuidv4 } from 'uuid';
import { VoiceLanguage, VoiceIntent } from 'shared-types';

export class VoiceInteractionAgent {
  static async run(commandId: string, agentRunId?: string): Promise<any> {
    const startTime = Date.now();
    const runId = agentRunId || uuidv4();
    console.log(`[VoiceInteractionAgent] Processing voice command: ${commandId}`);

    try {
      // 1. Fetch voice command from DB
      const command = db.prepare(`
        SELECT * FROM voice_commands WHERE id = ?
      `).get(commandId) as any;

      if (!command) {
        throw new Error(`Voice command not found: ${commandId}`);
      }

      const transcript = command.transcript;
      const lang = command.detected_language as VoiceLanguage;

      let intent: VoiceIntent = 'UNKNOWN';
      let skill: string | undefined = undefined;
      let location: string | undefined = undefined;
      let intentConfidence = 0.5;
      let skillConfidence = 0.0;
      let locationConfidence = 0.0;

      // Extract reference data dynamically from database
      const dbSkills = this.getSkillsFromDB();
      const dbLocations = this.getLocationsFromDB();

      // Lowercase transcript for keyword search
      const textLower = transcript.toLowerCase();

      // A. Intent classification rules
      if (
        textLower.includes('kam') || 
        textLower.includes('kaam') || 
        textLower.includes('naukri') || 
        textLower.includes('job') || 
        textLower.includes('search') || 
        textLower.includes('khoj') ||
        textLower.includes('chahiye')
      ) {
        intent = 'JOB_SEARCH';
        intentConfidence = 0.90;
      } else if (
        textLower.includes('registration') || 
        textLower.includes('register') || 
        textLower.includes('naya account')
      ) {
        intent = 'REGISTER';
        intentConfidence = 0.92;
      } else if (
        textLower.includes('badal') || 
        textLower.includes('update') || 
        textLower.includes('profile') ||
        textLower.includes('change')
      ) {
        intent = 'UPDATE_PROFILE';
        intentConfidence = 0.88;
      } else if (
        textLower.includes('apply') || 
        textLower.includes('bharna') || 
        textLower.includes('hissa')
      ) {
        intent = 'APPLY_JOB';
        intentConfidence = 0.85;
      } else if (
        textLower.includes('manzoor') || 
        textLower.includes('accept') || 
        textLower.includes('haami')
      ) {
        intent = 'ACCEPT_JOB';
        intentConfidence = 0.89;
      } else if (
        textLower.includes('open') || 
        textLower.includes('dikhao') || 
        textLower.includes('go to') || 
        textLower.includes('navigate')
      ) {
        intent = 'NAVIGATE';
        intentConfidence = 0.87;
      }

      // B. Slot Extraction via DB Lookup
      // Match skills against DB unique skills
      for (const sk of dbSkills) {
        if (textLower.includes(sk)) {
          skill = sk;
          skillConfidence = 0.95;
          break;
        }
      }

      // Match locations against DB locations
      for (const loc of dbLocations) {
        if (textLower.includes(loc)) {
          location = loc;
          locationConfidence = 0.95;
          break;
        }
      }

      const slots: any = {};
      const confidence: any = { stt: 0.9, intent: intentConfidence, slots: {} };

      if (skill) {
        slots.skill = skill;
        confidence.slots.skill = skillConfidence;
      } else {
        confidence.slots.skill = 0.0;
      }

      if (location) {
        slots.location = location;
        confidence.slots.location = locationConfidence;
      } else {
        confidence.slots.location = 0.0;
      }

      let status = 'ROUTED_TO_AGENT';
      let routedTo = 'NONE';

      // Validation logic: if intent requires slot but slot is missing or confidence is low (< 0.8)
      if (intent === 'JOB_SEARCH') {
        const hasSkill = slots.skill && confidence.slots.skill >= 0.8;
        const hasLocation = slots.location && confidence.slots.location >= 0.8;

        if (!hasSkill || !hasLocation) {
          status = 'NEEDS_CLARIFICATION';
          
          let missingField = '';
          let promptText = '';

          if (!hasSkill && !hasLocation) {
            missingField = 'skill_and_location';
            promptText = 'Aapko kis tareeh ka kaam chahiye aur kis jagah par? (Jaise: Delhi mein electrician ka kaam)';
          } else if (!hasSkill) {
            missingField = 'skill';
            promptText = 'Aapko kis hunar ya kaam ki talash hai? (Jaise: electrician, plumber ya mason)';
          } else {
            missingField = 'location';
            promptText = 'Aap kis jagah par kaam dhoodh rahe hain? (Jaise: Noida, Dwarka ya Connaught Place)';
          }

          // Insert clarification prompt
          db.prepare(`
            INSERT INTO voice_clarification_prompts (id, voice_command_id, missing_field, prompt_text, resolved, resolved_voice_command_id, created_at)
            VALUES (?, ?, ?, ?, 0, NULL, ?)
          `).run(uuidv4(), commandId, missingField, promptText, new Date().toISOString());
        } else {
          routedTo = 'WORKER_MATCHING';
        }
      } else if (intent === 'UPDATE_PROFILE') {
        const hasSkill = slots.skill && confidence.slots.skill >= 0.8;
        if (!hasSkill) {
          status = 'NEEDS_CLARIFICATION';
          db.prepare(`
            INSERT INTO voice_clarification_prompts (id, voice_command_id, missing_field, prompt_text, resolved, resolved_voice_command_id, created_at)
            VALUES (?, ?, ?, ?, 0, NULL, ?)
          `).run(
            uuidv4(), 
            commandId, 
            'skill', 
            'Aap profile mein kya update karna chahte hain? Kaunsa hunar jodne chahte hain?', 
            new Date().toISOString()
          );
        } else {
          routedTo = 'VERIFICATION';
        }
      }

      // Update voice command in DB
      db.prepare(`
        UPDATE voice_commands
        SET intent = ?, slots = ?, confidence = ?, status = ?, routed_to_agent = ?, agent_run_id = ?
        WHERE id = ?
      `).run(
        intent,
        JSON.stringify(slots),
        JSON.stringify(confidence),
        status,
        routedTo === 'NONE' ? null : routedTo,
        runId,
        commandId
      );

      // Write agent run logs
      const latency = Date.now() - startTime;
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'VOICE_INTERACTION', '1.0.0', ?, ?, ?, 'SUCCESS', ?, ?)
      `).run(
        runId,
        JSON.stringify({ commandId, transcript }),
        JSON.stringify({ intent, slots, confidence, status, routedTo }),
        JSON.stringify([commandId]),
        latency,
        new Date().toISOString()
      );

      return {
        voice_command_id: commandId,
        intent,
        slots,
        confidence,
        status,
        routed_to: routedTo,
        agent_run_id: runId
      };

    } catch (err: any) {
      console.error('[VoiceInteractionAgent] Error:', err);
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'VOICE_INTERACTION', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(
        runId,
        JSON.stringify({ commandId }),
        JSON.stringify({ error: err.message }),
        Date.now() - startTime,
        new Date().toISOString()
      );
      throw err;
    }
  }

  // Dynamic Skill Lookup from DB - Sourced purely from database worker profiles
  private static getSkillsFromDB(): string[] {
    const list = db.prepare('SELECT skills FROM worker_profiles').all() as { skills: string }[];
    const skills = new Set<string>();

    list.forEach(item => {
      try {
        const arr = JSON.parse(item.skills);
        if (Array.isArray(arr)) {
          arr.forEach((s: string) => {
            if (s) skills.add(s.toLowerCase().trim());
          });
        }
      } catch (e) {}
    });

    return Array.from(skills);
  }

  // Dynamic Location Lookup from DB - Extracted from existing job requirements raw texts
  private static getLocationsFromDB(): string[] {
    const list = db.prepare('SELECT raw_text FROM job_requirements').all() as { raw_text: string }[];
    const locations = new Set<string>();

    list.forEach(item => {
      const text = item.raw_text.toLowerCase();
      // Match patterns like "in <location>", "near <location>", "at <location>", "around <location>"
      // up to punctuation (comma, period, semicolon) or words like "to", "for", "and"
      const regex = /(?:in|near|at|around)\s+([^,\.\(;]+)/gi;
      let match;
      while ((match = regex.exec(text)) !== null) {
        let locPart = match[1].trim();
        // Clean up ending stop words or verbs (like "to fix", "for a", "and domestic")
        locPart = locPart.split(/\s+(?:to|for|and|with|need|should|will|is|are|a|an|the)\b/)[0].trim();
        if (locPart.length > 2) {
          locations.add(locPart);
          
          // Also add sub-parts to be flexible (e.g., "noida sector 62" -> add "noida", "sector 62")
          const words = locPart.split(/\s+/);
          if (words.length > 1) {
            words.forEach(word => {
              if (word.length > 3 && !['near', 'area', 'phase', 'sector', 'central'].includes(word)) {
                locations.add(word);
              }
            });
            // Handle combinations like "connaught place" -> add "connaught place" and "cp"
            if (locPart.includes('connaught place')) {
              locations.add('connaught place');
              locations.add('cp');
            }
          }
        }
      }
    });

    // Make sure we filter out empty values
    return Array.from(locations).filter(loc => loc.trim() !== '');
  }
}
export default VoiceInteractionAgent;
