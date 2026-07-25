import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, Volume2, HelpCircle } from 'lucide-react';

interface VoiceControlProps {
  userId: string;
  onCommandProcessed: (result: any) => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({ userId, onCommandProcessed }) => {
  const [language, setLanguage] = useState<'hi' | 'mr' | 'ta' | 'te' | 'bn' | 'en'>('hi');
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('Ready');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [clarificationNeeded, setClarificationNeeded] = useState<any | null>(null);
  const [clarificationValue, setClarificationValue] = useState<string>('');

  const [unsupportedLanguages, setUnsupportedLanguages] = useState<string[]>([]);
  const [langSupported, setLangSupported] = useState<boolean>(true);

  const recognitionRef = useRef<any>(null);

  const langCodes = {
    hi: 'hi-IN',
    mr: 'mr-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    bn: 'bn-IN',
    en: 'en-IN'
  };

  const langNames = {
    hi: 'Hindi (हिंदी)',
    mr: 'Marathi (मराठी)',
    ta: 'Tamil (தமிழ்)',
    te: 'Telugu (తెలుగు)',
    bn: 'Bengali (বাংলা)',
    en: 'English'
  };

  useEffect(() => {
    // 1. Browser Capability Check
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setErrorText('Voice interaction is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    // 2. Language Capability Check (check browser-specific limits)
    const ua = navigator.userAgent.toLowerCase();
    const isFirefox = ua.includes('firefox');
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isFirefox || isSafari) {
      // Firefox and Safari generally only support English or Hindi on default settings
      if (language !== 'en' && language !== 'hi') {
        setLangSupported(false);
        setErrorText(`voice not supported in this browser for ${langNames[language]} — use text instead`);
        setStatusText('Voice not supported for selected language');
      } else {
        setLangSupported(true);
        setErrorText(null);
        setStatusText('Ready');
      }
    } else {
      if (unsupportedLanguages.includes(language)) {
        setLangSupported(false);
        setErrorText(`voice not supported in this browser for ${langNames[language]} — use text instead`);
        setStatusText('Voice not supported for selected language');
      } else {
        setLangSupported(true);
        setErrorText(null);
        setStatusText('Ready');
      }
    }
  }, [language, unsupportedLanguages]);

  // Recalculate support when language changes
  const startRecording = () => {
    setErrorText(null);
    setTranscript('');
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = langCodes[language];

      recognition.onstart = () => {
        setIsRecording(true);
        setStatusText('Listening... Speak now.');
      };

      recognition.onerror = (event: any) => {
        console.error('Speech Recognition Error:', event);
        setIsRecording(false);
        if (event.error === 'language-not-supported') {
          setUnsupportedLanguages(prev => [...prev, language]);
          setLangSupported(false);
          setErrorText(`voice not supported in this browser for ${langNames[language]} — use text instead`);
          setStatusText('Voice not supported for selected language');
        } else if (event.error === 'no-speech') {
          setErrorText('No speech was detected. Please try again.');
        } else if (event.error === 'not-allowed') {
          setErrorText('Microphone access denied. Please enable mic permissions in your browser.');
        } else {
          setErrorText(`Voice command error: ${event.error}. Use text instead.`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.onresult = async (event: any) => {
        const resultText = event.results[0][0].transcript;
        setTranscript(resultText);
        setStatusText('Transcribing and routing...');
        
        await submitVoiceTranscript(resultText);
      };

      recognition.start();

    } catch (err: any) {
      console.error(err);
      setUnsupportedLanguages(prev => [...prev, language]);
      setLangSupported(false);
      setErrorText(`voice not supported in this browser for ${langNames[language]} — use text instead`);
      setStatusText('Voice not supported for selected language');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const submitVoiceTranscript = async (text: string) => {
    try {
      const response = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          transcript: text,
          raw_audio_ref: `https://voice.labourlink.in/audio/rec_${Date.now()}.wav`,
          detected_language: language
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to submit voice command');

      const data = resData.data;

      if (data.status === 'NEEDS_CLARIFICATION') {
        // Fetch details of clarification needed
        const detailsRes = await fetch(`/api/voice/command/${data.voice_command_id}`);
        const details = await detailsRes.json();
        if (details.prompts && details.prompts.length > 0) {
          setClarificationNeeded({
            commandId: data.voice_command_id,
            prompt: details.prompts[0]
          });
          setStatusText('Clarification needed.');
        }
      } else {
        setClarificationNeeded(null);
        setStatusText('Command processed successfully.');
        onCommandProcessed(data);
      }

    } catch (err: any) {
      setErrorText(err.message);
      setStatusText('Failed');
    }
  };

  const submitClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarificationValue.trim() || !clarificationNeeded) return;

    try {
      setStatusText('Submitting clarification...');
      const response = await fetch(`/api/voice/command/${clarificationNeeded.commandId}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: clarificationNeeded.prompt.missing_field,
          value: clarificationValue,
          next_transcript: clarificationValue
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to submit clarification');

      setClarificationNeeded(null);
      setClarificationValue('');
      setStatusText('Clarification resolved.');
      onCommandProcessed(resData);
    } catch (err: any) {
      setErrorText(err.message);
    }
  };

  return (
    <div className="card" style={{ border: '2px solid var(--primary-color)', backgroundColor: '#fcfdfd' }}>
      <div className="card-title" style={{ borderBottomColor: 'var(--primary-color)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)' }}>
          <Volume2 size={20} />
          Official Voice Command Portal (आवाज़ से खोजें)
        </span>
        <span className="badge badge-success">ASR Gateway</span>
      </div>

      {!isSupported ? (
        <div className="alert-banner alert-banner-error">
          <AlertCircle size={20} />
          <div>
            <strong>Voice Capability Warning:</strong> Voice control is not fully supported in this browser. Please use a text query instead.
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            <label className="form-label" style={{ margin: 0 }}>Select Language (भाषा चुनें):</label>
            <select 
              className="form-control" 
              style={{ width: '200px' }}
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              disabled={isRecording}
            >
              {Object.entries(langNames).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', backgroundColor: '#ffffff', marginBottom: '16px' }}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!langSupported}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: !langSupported ? '#cbd5e1' : (isRecording ? 'var(--error-color)' : 'var(--primary-color)'),
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: !langSupported ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
              }}
            >
              {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--secondary-color)' }}>
                Status: {statusText}
              </div>
              {transcript && (
                <div style={{ marginTop: '8px', fontStyle: 'italic', color: 'var(--text-primary)', padding: '6px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '2px' }}>
                  "{transcript}"
                </div>
              )}
            </div>
          </div>

          {errorText && (
            <div className="alert-banner alert-banner-warning" style={{ margin: 0 }}>
              <AlertCircle size={20} />
              <div>{errorText}</div>
            </div>
          )}

          {clarificationNeeded && (
            <div style={{ padding: '16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--border-radius)', marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#b45309', fontWeight: 'bold', marginBottom: '8px' }}>
                <HelpCircle size={18} />
                Clarification Required (स्पष्टीकरण आवश्यक)
              </div>
              <p style={{ fontSize: '13px', color: '#78350f', marginBottom: '12px' }}>
                {clarificationNeeded.prompt.prompt_text}
              </p>
              <form onSubmit={submitClarification} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder={`Enter missing ${clarificationNeeded.prompt.missing_field}...`}
                  value={clarificationValue}
                  onChange={(e) => setClarificationValue(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-accent">Submit</button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default VoiceControl;
