import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LogEntry, logger } from '@shell-ai/core';

interface LogViewerProps {
  onClose: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogEntry['level'] | 'all'>('all');
  const [displayStartIndex, setDisplayStartIndex] = useState(0);
  const [highlightIndex, setHighlightIndex] = useState(0); // Relative position (0-3) within visible logs

  const LOGS_PER_PAGE = 4;

  useEffect(() => {
    const unsubscribe = logger.addListener(setLogs);
    setLogs(logger.getLogs());

    // Initialize to show the latest logs
    const allLogs = logger.getLogs();
    if (allLogs.length > LOGS_PER_PAGE) {
      setDisplayStartIndex(allLogs.length - LOGS_PER_PAGE);
    } else {
      setDisplayStartIndex(0);
    }
    setHighlightIndex(0); // Start highlight at first visible log

    return unsubscribe;
  }, []);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
      return;
    }

    if (input === 'c') {
      logger.clear();
      return;
    }

    // Filter shortcuts
    if (input === '1') setFilter('all');
    if (input === '2') setFilter('info');
    if (input === '3') setFilter('warn');
    if (input === '4') setFilter('error');
    if (input === '5') setFilter('debug');

    const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);
    const maxStartIndex = Math.max(0, filteredLogs.length - LOGS_PER_PAGE);

    // Scroll controls
    if (key.upArrow) {
      if (highlightIndex > 0) {
        // Just move the highlight up within visible logs
        setHighlightIndex(prev => prev - 1);
      } else if (displayStartIndex > 0) {
        // Scroll up to show previous log
        setDisplayStartIndex(prev => prev - 1);
      }
    }

    if (key.downArrow) {
      if (
        highlightIndex < Math.min(LOGS_PER_PAGE - 1, filteredLogs.length - displayStartIndex - 1)
      ) {
        // Just move the highlight down within visible logs
        setHighlightIndex(prev => prev + 1);
      } else if (displayStartIndex < maxStartIndex) {
        // Scroll down to show next log
        setDisplayStartIndex(prev => prev + 1);
      }
    }

    if (key.pageUp) {
      const newStartIndex = Math.max(0, displayStartIndex - LOGS_PER_PAGE);
      setDisplayStartIndex(newStartIndex);

      // Adjust highlight if necessary (if we hit the top)
      if (newStartIndex === 0 && highlightIndex > filteredLogs.length - 1) {
        setHighlightIndex(Math.max(0, filteredLogs.length - 1));
      }
    }

    if (key.pageDown) {
      const newStartIndex = Math.min(maxStartIndex, displayStartIndex + LOGS_PER_PAGE);
      setDisplayStartIndex(newStartIndex);

      // Adjust highlight if necessary (if we hit the bottom)
      if (
        newStartIndex === maxStartIndex &&
        highlightIndex > filteredLogs.length - newStartIndex - 1
      ) {
        setHighlightIndex(Math.max(0, filteredLogs.length - newStartIndex - 1));
      }
    }
  });

  // Apply filtering
  const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.level === filter);

  // Recalculate display start index when filter changes to show latest logs
  useEffect(() => {
    if (filteredLogs.length > LOGS_PER_PAGE) {
      setDisplayStartIndex(filteredLogs.length - LOGS_PER_PAGE);
    } else {
      setDisplayStartIndex(0);
    }
    setHighlightIndex(0);
  }, [filter, filteredLogs.length]);

  // Get logs to display based on current scroll position
  const visibleLogs = filteredLogs.slice(displayStartIndex, displayStartIndex + LOGS_PER_PAGE);

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'red';
      case 'warn':
        return 'yellow';
      case 'info':
        return 'blue';
      case 'debug':
        return 'gray';
      default:
        return 'white';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Box
      flexDirection="column"
      height="100%"
      width="100%"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexWrap="wrap"
    >
      {/* Header */}
      <Text color="cyan" bold wrap="truncate">
        Log Viewer ({filteredLogs.length} entries)
      </Text>

      {/* Controls */}
      <Box borderStyle="single" borderColor="gray" padding={1}>
        <Text color="gray" wrap="wrap">
          Filter: <Text color="white">[1]</Text>All <Text color="white">[2]</Text>Info{' '}
          <Text color="white">[3]</Text>Warn <Text color="white">[4]</Text>Error{' '}
          <Text color="white">[5]</Text>Debug | <Text color="white">[C]</Text>lear |{' '}
          <Text color="white">[Q/ESC]</Text>Close | <Text color="white">↑↓</Text>Scroll{' '}
          <Text color="white">PgUp/PgDn</Text>Fast
        </Text>
      </Box>

      {/* Current Filter & Stats */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text color="white">
          Filter:{' '}
          <Text color="cyan" bold>
            {filter.toUpperCase()}
          </Text>
        </Text>
        <Box>
          <Text color="red">Errors: {logger.getErrorCount()}</Text>
          <Text color="yellow"> | Warnings: {logger.getWarningCount()}</Text>
        </Box>
      </Box>

      {/* Logs */}
      <Box flexDirection="column" flexGrow={1} width="100%" overflowY="hidden">
        {visibleLogs.length === 0 ? (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <Text color="gray">No logs to display</Text>
          </Box>
        ) : (
          visibleLogs.map((log, index) => {
            return (
              <Box
                key={`${log.timestamp.getTime()}-${index + displayStartIndex}`}
                marginBottom={0}
                paddingX={1}
                backgroundColor={index === highlightIndex ? 'gray' : 'transparent'}
              >
                <Box minWidth={9}>
                  <Text color="gray" dimColor>
                    {formatTimestamp(log.timestamp)}
                  </Text>
                </Box>
                <Box minWidth={8} marginLeft={1}>
                  <Text color={getLogColor(log.level)}>{log.level.toUpperCase().padEnd(5)}</Text>
                </Box>
                {log.source && (
                  <Box minWidth={12} marginLeft={1}>
                    <Text color="magenta" dimColor>
                      [{log.source}]
                    </Text>
                  </Box>
                )}
                <Box flexGrow={1} marginLeft={1}>
                  <Text wrap="wrap">{log.message}</Text>
                  {log.details && (
                    <Text color="gray" dimColor>
                      {' '}
                      (
                      {typeof log.details === 'object'
                        ? JSON.stringify(log.details)
                        : String(log.details)}
                      )
                    </Text>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {/* Footer */}
      <Box justifyContent="space-between" width="100%">
        <Text color="gray">
          Showing {displayStartIndex + 1}-
          {Math.min(displayStartIndex + visibleLogs.length, filteredLogs.length)} of{' '}
          {filteredLogs.length} logs
        </Text>
        {filteredLogs.length > 0 && (
          <Text color="gray">
            Selected: {displayStartIndex + highlightIndex + 1}/{filteredLogs.length}
          </Text>
        )}
      </Box>
    </Box>
  );
};
