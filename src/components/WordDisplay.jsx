import { useRef, useEffect } from 'react';
import { splitAtORP } from '../utils';

const WordDisplay = ({ engineRef }) => {
  const wrapperRef = useRef(null);
  const beforeRef = useRef(null);
  const pivotRef = useRef(null);
  const afterRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const engine = engineRef.current;

    const handleWord = (token) => {
      const wrapper = wrapperRef.current;
      const beforeElement = beforeRef.current;
      const pivotElement = pivotRef.current;
      const afterElement = afterRef.current;

      if (!wrapper || !beforeElement || !pivotElement || !afterElement) return;

      const { before, pivot, after } = splitAtORP(token.text);
      beforeElement.textContent = before;
      pivotElement.textContent = pivot;
      afterElement.textContent = after;

      wrapper.style.transform = 'scale(1)';

      const containerWidth = wrapper.clientWidth;
      const pivotWidth = pivotElement.scrollWidth;

      const availableSideWidth = (containerWidth - pivotWidth) / 2;
      const beforeWidth = beforeElement.scrollWidth;
      const afterWidth = afterElement.scrollWidth;
      const longestSide = Math.max(beforeWidth, afterWidth);

      if (longestSide > availableSideWidth) {
        const scale = Math.max(0.5, availableSideWidth / longestSide);
        wrapper.style.transformOrigin = 'center';
        wrapper.style.transform = `scale(${scale})`;
      }
    };

    const handleProgress = (value) => {
      if (progressRef.current) {
        progressRef.current.style.width = `${value * 100}%`;
      }
    };

    engine.onWord = handleWord;
    engine.onProgress = handleProgress;

    return () => {
      if (engine.onWord === handleWord) engine.onWord = null;
      if (engine.onProgress === handleProgress) engine.onProgress = null;
    };
  }, [engineRef]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="rounded-xl bg-card text-card-foreground shadow-2xl">
          <div className="relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-full bg-primary/5 rounded-xl" />

            <div
              ref={progressRef}
              className="absolute inset-y-0 left-0 w-0 bg-linear-to-r from-primary/5 via-primary/5 to-primary/5 transition-[width] duration-200 ease-linear rounded-xl"
            />

            <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-primary/20" />

            <div className="relative z-10 flex min-h-40 items-center md:min-h-80">
              <div
                ref={wrapperRef}
                className="relative flex w-full whitespace-nowrap font-mono text-3xl font-bold tracking-wider md:text-7xl"
              >
                <span
                  ref={beforeRef}
                  className="min-w-0 flex-1 text-right text-foreground"
                />
                <span ref={pivotRef} className="shrink-0 text-primary" />
                <span
                  ref={afterRef}
                  className="min-w-0 flex-1 text-left text-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WordDisplay;
