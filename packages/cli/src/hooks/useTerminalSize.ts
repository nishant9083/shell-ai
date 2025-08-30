import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

export const useTerminalSize = () => {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    columns: stdout.columns,
    rows: stdout.rows,
  });

  // Listen for resize events
  useEffect(() => {
    const handleResize = () => {
      setSize({
        columns: stdout.columns,
        rows: stdout.rows,
      });
    };

    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.removeListener('resize', handleResize);
    };
  }, [stdout]);

  return size;
};
