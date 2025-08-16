import figures from 'figures';
import { useApp, useInput, Box, Static, Spacer, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useState, useRef, useCallback } from 'react';
import { ConfigManager } from '@shell-ai/core';

import Autocomplete, { AutocompleteOption } from '../cli/autocomplete.js';
import { LangGraphAgentAdapter } from '../cli/langgraph-agent-adapter.js';
import { ChatMessage, AgentAction } from '../types/index.js';

import { shortAsciiLogo } from './logo.js';
import DynamicMarkdown from './markdown.js';

type ChatAppProps = {
  configManager: ConfigManager;
  agentProcessor: LangGraphAgentAdapter;
  messages: ChatMessage[];
  handleUserInput: (
    input: string,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    setAgentActions: React.Dispatch<React.SetStateAction<AgentAction | null>>,
    setPendingConfirmation: React.Dispatch<React.SetStateAction<any>>,
    setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>,
    updateStaticKey: () => void,
    exit: () => void
  ) => Promise<void>;
  handleConfirmation: (
    approved: boolean,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    pendingConfirmation: { callback: (result: boolean) => void; content: string },
    setPendingConfirmation: React.Dispatch<React.SetStateAction<any>>
  ) => Promise<void>;
  updateAutocomplete: (
    input: string,
    setShowAutocomplete: React.Dispatch<React.SetStateAction<boolean>>,
    setAutocompleteOptions: React.Dispatch<React.SetStateAction<AutocompleteOption[]>>,
    setAutocompleteIndex: React.Dispatch<React.SetStateAction<number>>
  ) => Promise<void>;
  applyAutocomplete: (
    option: AutocompleteOption,
    inputRef: React.MutableRefObject<string>,
    setCurrentInput: React.Dispatch<React.SetStateAction<string>>
  ) => void;
};

export const ChatApp: React.FC<ChatAppProps> = props => {
  const [messages, setMessages] = useState<ChatMessage[]>(props.messages);
  const [staticKey, setStaticKey] = useState<number>(0);
  const [currentInput, setCurrentInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0); // Track cursor position
  const [agentActions, setAgentActions] = useState<AgentAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    callback: (result: boolean) => void;
    content: string;
  } | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteOptions, setAutocompleteOptions] = useState<AutocompleteOption[]>([]);
  const inputRef = useRef<string>('');
  const { exit } = useApp();

  const updateStaticKey = useCallback(() => {
    setStaticKey(prev => prev + 1);
  }, [setStaticKey]);

  useInput(async (input, key) => {
    // Handle ESC key for cancellation
    if (key.escape) {
      if (isProcessing) {
        // Cancel the current agent operation
        props.agentProcessor.cancel();
        setIsProcessing(false);
        setAgentActions(null);

        // Add cancellation message
        const cancelMessage: ChatMessage = {
          role: 'system',
          content: '🚫 Operation cancelled by user',
          timestamp: new Date(),
          display: true,
        };
        props.messages.push(cancelMessage);
        setMessages([...props.messages]);
        return;
      } else if (showAutocomplete) {
        // Close autocomplete
        setShowAutocomplete(false);
        setAutocompleteIndex(0);
        return;
      }
      // else if (pendingConfirmation) {
      //   // Cancel confirmation
      //   setPendingConfirmation(null);
      //   return;
      // }
      // // If nothing to cancel, just clear input
      // inputRef.current = '';
      // setCurrentInput('');
      // setCursorPosition(0);
      return;
    }

    if (pendingConfirmation) {
      if (key.return) {
        const isConfirmed =
          inputRef.current.toLowerCase().trim() === 'y' ||
          inputRef.current.toLowerCase().trim() === 'yes';
        props.handleConfirmation(
          isConfirmed,
          setMessages,
          pendingConfirmation,
          setPendingConfirmation
        );
        inputRef.current = '';
        setCurrentInput('');
        setCursorPosition(0); // Reset cursor position
      } else if (key.backspace || key.delete) {
        // Handle backspace at cursor position
        if (cursorPosition > 0) {
          inputRef.current =
            inputRef.current.slice(0, cursorPosition - 1) + inputRef.current.slice(cursorPosition);
          setCursorPosition(prev => Math.max(0, prev - 1));
          setCurrentInput(inputRef.current);
        }
      } else if (input) {
        // Insert text at cursor position
        inputRef.current =
          inputRef.current.slice(0, cursorPosition) +
          input +
          inputRef.current.slice(cursorPosition);
        setCursorPosition(cursorPosition + input.length);
        setCurrentInput(inputRef.current);
      }
      return;
    }

    if (isProcessing) return;

    // Handle cursor movement with arrow keys
    if (key.leftArrow) {
      setCursorPosition(prev => Math.max(0, prev - 1));
      return;
    } else if (key.rightArrow) {
      setCursorPosition(prev => Math.min(inputRef.current.length, prev + 1));
      return;
    }

    // Handle autocomplete navigation
    if (showAutocomplete && autocompleteOptions.length > 0) {
      if (key.upArrow) {
        setAutocompleteIndex(prev => (prev > 0 ? prev - 1 : autocompleteOptions.length - 1));
        return;
      } else if (key.downArrow) {
        setAutocompleteIndex(prev => (prev < autocompleteOptions.length - 1 ? prev + 1 : 0));
        return;
      } else if (key.tab || key.return) {
        const selectedOption = autocompleteOptions[autocompleteIndex];
        if (selectedOption) {
          props.applyAutocomplete(selectedOption, inputRef, setCurrentInput);
          setCursorPosition(inputRef.current.length);
          await props.updateAutocomplete(
            inputRef.current,
            setShowAutocomplete,
            setAutocompleteOptions,
            setAutocompleteIndex
          );
          if (key.return && inputRef.current.startsWith('/')) {
            await props.handleUserInput(
              inputRef.current.trim(),
              setMessages,
              setAgentActions,
              setPendingConfirmation,
              setIsProcessing,
              updateStaticKey,
              exit
            );
            inputRef.current = '';
            setCurrentInput('');
            setCursorPosition(0); // Reset cursor position
            setShowAutocomplete(false);
            setAutocompleteIndex(0);
          }
        }
        return;
      } else if (key.escape) {
        setShowAutocomplete(false);
        setAutocompleteIndex(0);
        return;
      }
    }

    if (key.return) {
      if (inputRef.current.trim()) {
        props.handleUserInput(
          inputRef.current.trim(),
          setMessages,
          setAgentActions,
          setPendingConfirmation,
          setIsProcessing,
          updateStaticKey,
          exit
        );
        inputRef.current = '';
        setCurrentInput('');
        setCursorPosition(0); // Reset cursor position
        setShowAutocomplete(false);
        setAutocompleteIndex(0);
      }
    } else if (key.backspace || key.delete) {
      // Handle backspace at cursor position
      if (cursorPosition > 0) {
        inputRef.current =
          inputRef.current.slice(0, cursorPosition - 1) + inputRef.current.slice(cursorPosition);
        setCursorPosition(prev => Math.max(0, prev - 1));
        setCurrentInput(inputRef.current);
        await props.updateAutocomplete(
          inputRef.current,
          setShowAutocomplete,
          setAutocompleteOptions,
          setAutocompleteIndex
        );
      }
    } else if (input) {
      // Insert text at cursor position
      inputRef.current =
        inputRef.current.slice(0, cursorPosition) + input + inputRef.current.slice(cursorPosition);
      setCursorPosition(cursorPosition + input.length);
      setCurrentInput(inputRef.current);
      if (
        !showAutocomplete &&
        (inputRef.current.startsWith('/') || inputRef.current.includes('@'))
      ) {
        setShowAutocomplete(true);
      }
      await props.updateAutocomplete(
        inputRef.current,
        setShowAutocomplete,
        setAutocompleteOptions,
        setAutocompleteIndex
      );
    }
  });

  const renderMessage = (msg: ChatMessage): JSX.Element => {
    const getIcon = () => {
      switch (msg.role) {
        case 'user':
          return figures.pointer;
        case 'assistant':
          return figures.star;
        case 'tool':
          return figures.play;
        case 'system':
          return figures.info;
        default:
          return figures.bullet;
      }
    };

    const getColor = () => {
      switch (msg.role) {
        case 'user':
          return 'blue';
        case 'assistant':
          return 'green';
        case 'tool':
          return 'magenta';
        case 'system':
          return 'gray';
        default:
          return 'white';
      }
    };

    return (
      <Box flexDirection="column">
        <Box>
          <Text color={getColor()} bold>
            {getIcon()}{' '}
            {msg.role === 'user'
              ? 'You'
              : msg.role === 'assistant'
                ? 'Agent'
                : msg.role === 'tool'
                  ? 'Tool'
                  : 'System'}
            :
          </Text>
        </Box>
        <Box paddingLeft={2}>
          <DynamicMarkdown>{msg.content}</DynamicMarkdown>
        </Box>
        {msg.toolCall && (
          <Box paddingLeft={2} marginTop={1}>
            <Text color="cyan" dimColor>
              {figures.arrowRight} Used tool: {msg.toolCall.tool}
            </Text>
            {msg.toolCall.result && (
              <Text color={msg.toolCall.result.success ? 'green' : 'red'} dimColor>
                {figures.arrowRight} Result: {msg.toolCall.result.success ? 'Success' : 'Failed'}
              </Text>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const config = props.configManager.getConfig();

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Static
          key={staticKey}
          items={[
            <Text key="logo" color="cyan" bold>
              {shortAsciiLogo}
            </Text>,
            ...messages
              .filter(msg => msg.display === true)
              .map((msg, index) => (
                <Box key={index} marginBottom={1}>
                  {renderMessage(msg)}
                </Box>
              )),
          ]}
        >
          {item => item}
        </Static>
      </Box>

      {/* Processing Indicator */}
      {agentActions && (
        <Box marginBottom={1}>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text color="yellow" dimColor>{`${agentActions.content} (esc to cancel)`}</Text>
        </Box>
      )}

      {/* Confirmation Prompt */}
      {pendingConfirmation ? (
        <Box marginBottom={1} borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow" bold>
            {figures.warning} Confirmation Required:
          </Text>
          <Text> {pendingConfirmation.content}</Text>
          <Text color="green">Continue? (y/n): {currentInput}</Text>
        </Box>
      ) : (
        !isProcessing && (
          <Box flexDirection="column">
            <Box borderStyle="round" borderColor="blue" padding={1} width={'80%'}>
              <Text color="blue" bold>
                {figures.pointer}{' '}
              </Text>
              {currentInput ? (
                <>
                  <Text wrap="wrap">
                    {currentInput.slice(0, cursorPosition)}
                    <Text inverse>{currentInput[cursorPosition] || ' '}</Text>
                    {currentInput.slice(cursorPosition + 1)}
                  </Text>
                </>
              ) : (
                <>
                  <Text color="gray" bold>
                    Type "/" for commands or "@" for file references
                  </Text>
                  <Spacer />
                  <Text color="gray" dimColor>
                    Type /help for commands
                  </Text>
                </>
              )}
            </Box>
            {/* Autocomplete */}
            {showAutocomplete && (
              <Autocomplete selectedIndex={autocompleteIndex} options={autocompleteOptions} />
            )}
          </Box>
        )
      )}

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between" padding={1}>
        <Text color="gray">{config.workingDirectory}</Text>
        <Box paddingLeft={2}>
          <Text color="cyan">{config.currentModel}</Text>
        </Box>
      </Box>
    </Box>
  );
};
