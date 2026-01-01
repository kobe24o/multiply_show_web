import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MultiplicationAnimationProps {
  num1: number;
  num2: number;
  isPlaying: boolean;
  speed: number;
}

interface DigitStep {
  multiplierIndex: number; // 乘数的位索引
  multiplicandIndex: number; // 被乘数的位索引
  result: number; // 单次乘法结果
  carry: number; // 本次产生的进位
  displayDigit: number; // 要显示的数字
  usedCarry: number; // 本次使用的进位
}

interface AdditionStep {
  columnIndex: number; // 从右到左的列索引（0是个位）
  values: number[]; // 该列所有要相加的值
  usedCarry: number; // 使用的进位
  sum: number; // 总和
  displayDigit: number; // 要显示的数字
  carry: number; // 产生的进位
}

interface ConnectionLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function MultiplicationAnimation({ num1, num2, isPlaying, speed }: MultiplicationAnimationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [displayedDigits, setDisplayedDigits] = useState<{[key: string]: {id: number; value: number}[]}>({});
  const [currentCarries, setCurrentCarries] = useState<{[key: number]: number}>({});
  const [additionCarries, setAdditionCarries] = useState<{[key: number]: number}>({});
  const [connectionLine, setConnectionLine] = useState<ConnectionLine | null>(null);
  const [currentHighlight, setCurrentHighlight] = useState<{multiplier: number, multiplicand: number} | null>(null);
  const [highlightColumn, setHighlightColumn] = useState<number | null>(null);
  const [finalResultDigits, setFinalResultDigits] = useState<{id: number; value: number}[]>([]);
  const nextDigitId = useRef(1);
  // Track freshly added digit ids so we only animate new digits once
  const freshDigitsRef = useRef<Set<number>>(new Set());
  
  const num1Ref = useRef<(HTMLSpanElement | null)[]>([]);
  const num2Ref = useRef<(HTMLSpanElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // 生成所有的乘法步骤
  const generateMultiplicationSteps = (): DigitStep[] => {
    const num1Str = String(num1);
    const num2Str = String(num2);
    const steps: DigitStep[] = [];
    
    // 对每个乘数位
    for (let i = num2Str.length - 1; i >= 0; i--) {
      const multiplierDigit = parseInt(num2Str[i]);
      let carry = 0;
      
      // 对被乘数的每一位（从右到左）
      for (let j = num1Str.length - 1; j >= 0; j--) {
        const multiplicandDigit = parseInt(num1Str[j]);
        const product = multiplicandDigit * multiplierDigit + carry;
        const displayDigit = product % 10;
        const newCarry = Math.floor(product / 10);
        
        steps.push({
          multiplierIndex: i,
          multiplicandIndex: j,
          result: product,
          carry: newCarry,
          displayDigit: displayDigit,
          usedCarry: carry
        });
        
        carry = newCarry;
      }
      
      // 如果还有进位，需要添加
      if (carry > 0) {
        steps.push({
          multiplierIndex: i,
          multiplicandIndex: -1, // 表示这是最后的进位
          result: carry,
          carry: 0,
          displayDigit: carry,
          usedCarry: 0
        });
      }
    }
    
    return steps;
  };

  // 生成所有部分积
  const generatePartialProducts = () => {
    const num1Str = String(num1);
    const num2Str = String(num2);
    const partialProducts: number[][] = [];
    
    for (let i = num2Str.length - 1; i >= 0; i--) {
      const multiplierDigit = parseInt(num2Str[i]);
      let carry = 0;
      const product: number[] = [];
      
      for (let j = num1Str.length - 1; j >= 0; j--) {
        const multiplicandDigit = parseInt(num1Str[j]);
        const prod = multiplicandDigit * multiplierDigit + carry;
        product.unshift(prod % 10);
        carry = Math.floor(prod / 10);
      }
      
      if (carry > 0) {
        product.unshift(carry);
      }
      
      // 添加位移（后面补0）
      const position = num2Str.length - 1 - i;
      for (let k = 0; k < position; k++) {
        product.push(0);
      }
      
      partialProducts.push(product);
    }
    
    return partialProducts;
  };

  // 生成加法步骤
  const generateAdditionSteps = (): AdditionStep[] => {
    const partialProducts = generatePartialProducts();
    const maxLength = Math.max(...partialProducts.map(p => p.length));
    const steps: AdditionStep[] = [];
    let carry = 0;
    
    // 从右到左逐列相加
    for (let col = maxLength - 1; col >= 0; col--) {
      const values: number[] = [];
      
      // 收集该列的所有数字
      for (let row = 0; row < partialProducts.length; row++) {
        const product = partialProducts[row];
        const digit = product[col - (maxLength - product.length)];
        if (digit !== undefined) {
          values.push(digit);
        }
      }
      
      const sum = values.reduce((a, b) => a + b, 0) + carry;
      const displayDigit = sum % 10;
      const newCarry = Math.floor(sum / 10);
      
      steps.push({
        columnIndex: maxLength - 1 - col,
        values,
        usedCarry: carry,
        sum,
        displayDigit,
        carry: newCarry
      });
      
      carry = newCarry;
    }
    
    // 如果最后还有进位，添加一个额外的步骤
    if (carry > 0) {
      steps.push({
        columnIndex: maxLength,
        values: [],
        usedCarry: carry,
        sum: carry,
        displayDigit: carry,
        carry: 0
      });
    }
    
    return steps;
  };

  const multiplicationSteps = generateMultiplicationSteps();
  const additionSteps = generateAdditionSteps();
  const num1Str = String(num1);
  const num2Str = String(num2);
  const finalResult = num1 * num2;
  
  // 计算总步骤数：乘法步骤 + 横线 + 加法步骤 + 最终横线
  const totalSteps = multiplicationSteps.length + 1 + additionSteps.length + 1;

  // 计算连接线
  const updateConnectionLine = (multiplicandIndex: number, multiplierIndex: number) => {
    const num1Elem = num1Ref.current[multiplicandIndex];
    const num2Elem = num2Ref.current[multiplierIndex];
    
    if (!num1Elem || !num2Elem || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const num1Rect = num1Elem.getBoundingClientRect();
    const num2Rect = num2Elem.getBoundingClientRect();
    
    setConnectionLine({
      from: {
        x: num1Rect.left + num1Rect.width / 2 - containerRect.left,
        y: num1Rect.top + num1Rect.height / 2 - containerRect.top
      },
      to: {
        x: num2Rect.left + num2Rect.width / 2 - containerRect.left,
        y: num2Rect.top + num2Rect.height / 2 - containerRect.top
      }
    });
  };

  useEffect(() => {
    if (isPlaying && currentStepIndex < totalSteps) {
      const timer = setTimeout(() => {
        if (currentStepIndex < multiplicationSteps.length) {
          const step = multiplicationSteps[currentStepIndex];
          
          // 显示连接线和高亮
          if (step.multiplicandIndex >= 0) {
            updateConnectionLine(step.multiplicandIndex, step.multiplierIndex);
            setCurrentHighlight({
              multiplier: step.multiplierIndex,
              multiplicand: step.multiplicandIndex
            });
          }
          
          // 延迟显示结果数字
          setTimeout(() => {
            // 添加数字到显示（带稳定 id），标记为新加入以便只对新数字做入场动画
            const key = `row-${step.multiplierIndex}`;
            const newId = nextDigitId.current++;
            freshDigitsRef.current.add(newId);
            setDisplayedDigits(prev => ({
              ...prev,
              [key]: [...(prev[key] || []), { id: newId, value: step.displayDigit }]
            }));
            
            // 重置进位状态，只保留当前新产生的进位
            // 确保同一时刻只有一个进位显示
            if (step.carry > 0) {
              setCurrentCarries({
                // 只保留当前新产生的进位，删除所有旧进位
                // 进位key：[乘数索引]-[被乘数索引+1]
                // 被乘数索引+1：表示进位要加到的位置
                [`${step.multiplierIndex}-${step.multiplicandIndex + 1}`]: step.carry
              });
            } else {
              // 如果没有新进位，清空所有进位
              setCurrentCarries({});
            }
            
            // 立即清除被使用的进位（加到结果里面就消失）
            if (step.usedCarry > 0) {
              setCurrentCarries(prev => {
                const newCarries = { ...prev };
                // 删除当前步骤使用的进位
                delete newCarries[`${step.multiplierIndex}-${step.multiplicandIndex}`];
                return newCarries;
              });
            }
            
            // 立即清除连接线和高亮，实现"加完结果就消失"的效果
            setConnectionLine(null);
            setCurrentHighlight(null);
          }, 800 / speed);
        } else if (currentStepIndex < multiplicationSteps.length + 1) {
          // 显示加法横线
          // 清空乘法进位显示
          setCurrentCarries({});
          
          // 计算乘法产生的所有进位，并转换为加法列的进位显示
          // 先从备份中获取最后的进位状态（在清空前）
          // 因为需要访问最后的乘法步骤产生的进位
          const multiplicationStepsLastIndex = multiplicationSteps.length - 1;
          let lastMultiplicationCarries: {[key: string]: number} = {};
          
          // 重新计算最后的进位状态
          let tempCarries: {[key: string]: number} = {};
          for (let stepIdx = 0; stepIdx < multiplicationSteps.length; stepIdx++) {
            const step = multiplicationSteps[stepIdx];
            if (step.carry > 0) {
              tempCarries[`${step.multiplierIndex}-${step.multiplicandIndex}`] = step.carry;
            }
            // 模拟进位消失逻辑
            if (step.multiplicandIndex < num1Str.length - 1) {
              delete tempCarries[`${step.multiplierIndex}-${step.multiplicandIndex + 1}`];
            }
          }
          lastMultiplicationCarries = tempCarries;
          
          // 转换为加法列的进位显示
          const allMultiplicationCarries: {[key: number]: number} = {};
          
          for (const key in lastMultiplicationCarries) {
            const [multiplierIdx, mcIdx] = key.split('-').map(Number);
            // 进位在部分积中显示的位置是左移一位：mcIdx-1
            // 在加法列中的位置 = (mcIdx-1) + rowPosition
            const displayPosition = mcIdx - 1;
            const rowPosition = num2Str.length - 1 - multiplierIdx;
            const columnIndex = displayPosition + rowPosition;
            if (columnIndex >= 0) {
              allMultiplicationCarries[columnIndex] = lastMultiplicationCarries[key];
            }
          }
          
          // 设置加法进位显示
          setAdditionCarries(allMultiplicationCarries);
        } else if (currentStepIndex < multiplicationSteps.length + 1 + additionSteps.length) {
          const additionStepIndex = currentStepIndex - multiplicationSteps.length - 1;
          const step = additionSteps[additionStepIndex];
          
          // 高亮列
          setHighlightColumn(step.columnIndex);
          
          // 延迟显示结果数字
          setTimeout(() => {
            // 插入最终结果数字（带稳定 id），并标记为新加入
            const newId = nextDigitId.current++;
            freshDigitsRef.current.add(newId);
            setFinalResultDigits(prev => [
              ...prev,
              { id: newId, value: step.displayDigit }
            ]);
            
            // 显示新的进位（在左边一位上）
            if (step.carry > 0 && step.columnIndex < additionSteps.length - 1) {
              setAdditionCarries(prev => ({
                ...prev,
                [step.columnIndex + 1]: step.carry
              }));
            }
            
            // 延迟 0.5 秒后清除进位
            setTimeout(() => {
              // 清除当前使用的进位
              setAdditionCarries(prev => {
                const newCarries = { ...prev };
                // 清除这一列的进位
                if (step.columnIndex >= 0) {
                  delete newCarries[step.columnIndex];
                }
                return newCarries;
              });
              
              // 如果是最后一步，清除所有剩余进位
              const isLastStep = additionStepIndex === additionSteps.length - 1;
              if (isLastStep) {
                setTimeout(() => {
                  setAdditionCarries({});
                }, 100 / speed);
              }
              
              // 清除高亮列
              setHighlightColumn(null);
            }, 500 / speed);
          }, 800 / speed);
        }
        
        setCurrentStepIndex(prev => prev + 1);
      }, 2000 / speed);
      
      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentStepIndex, totalSteps, speed]);

  useEffect(() => {
    setCurrentStepIndex(0);
    setDisplayedDigits({});
    setCurrentCarries({});
    setAdditionCarries({});
    setConnectionLine(null);
    setCurrentHighlight(null);
    setHighlightColumn(null);
    setFinalResultDigits([]);
    nextDigitId.current = 1;
    freshDigitsRef.current.clear();
  }, [num1, num2]);

  // 清除刚添加的 digit 标记，保证新加入的数字只做一次入场动画
  useEffect(() => {
    if (freshDigitsRef.current.size === 0) return;
    const t = setTimeout(() => {
      freshDigitsRef.current.clear();
    }, 1200 / Math.max(0.1, speed));
    return () => clearTimeout(t);
  }, [currentStepIndex, speed]);

  // 获取每行应该显示的完整数字
  const getRowDigits = (multiplierIndex: number) => {
    const key = `row-${multiplierIndex}`;
    const digits = [...(displayedDigits[key] || [])]; // 创建副本，避免修改原数组
    const position = num2Str.length - 1 - multiplierIndex;

    return {
      // 视觉上需要从高位到低位显示，所以反转副本，但保留 id 与 value
      digits: digits.reverse(),
      position: Math.max(0, position) // 确保 position 不为负数
    };
  };

  // 获取所有已完成的行
  const completedRows = Object.keys(displayedDigits).map(key => {
    const multiplierIndex = parseInt(key.split('-')[1]);
    return multiplierIndex;
  }).filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => b - a);

  const maxLength = Math.max(num1Str.length, num2Str.length, String(finalResult).length);
  
  // 获取部分积的完整数组（用于加法高亮）
  const partialProducts = generatePartialProducts();
  const partialProductsMaxLength = partialProducts.length > 0 ? Math.max(...partialProducts.map(p => p.length)) : 0;
  // 加法结果的最大长度（可能包含进位产生的额外一位）
  const additionResultLength = Math.max(partialProductsMaxLength, finalResultDigits.length);

  return (
    <div ref={containerRef} className="relative flex flex-col items-center justify-center min-h-[500px]">
      {/* SVG for connection line */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
        <AnimatePresence>
          {connectionLine && (
            <motion.line
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              x1={connectionLine.from.x}
              y1={connectionLine.from.y}
              x2={connectionLine.to.x}
              y2={connectionLine.to.y}
              stroke="#ef4444"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
        </AnimatePresence>
      </svg>

      <div className="font-mono text-3xl space-y-2 relative">
        {/* 被乘数 */}
        <div className="flex justify-end items-center gap-8">
          <div className="text-gray-400 text-sm w-24 text-right">被乘数</div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2"
          >
            {num1Str.split('').map((digit, i) => (
              <span
                key={i}
                ref={el => num1Ref.current[i] = el}
                className={`w-12 text-center transition-all duration-300 ${
                  currentHighlight?.multiplicand === i
                    ? 'bg-blue-200 text-blue-900 rounded scale-110'
                    : ''
                }`}
              >
                {digit}
              </span>
            ))}
          </motion.div>
        </div>

        {/* 乘号和乘数 */}
        <div className="flex justify-end items-center gap-8">
          <div className="text-gray-400 text-sm w-24 text-right">× 乘数</div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex gap-2"
          >
            <span className="w-12 text-center">×</span>
            {num2Str.split('').map((digit, i) => (
              <span
                key={i}
                ref={el => num2Ref.current[i] = el}
                className={`w-12 text-center transition-all duration-300 ${
                  currentHighlight?.multiplier === i
                    ? 'bg-yellow-300 text-yellow-900 rounded scale-110'
                    : ''
                }`}
              >
                {digit}
              </span>
            ))}
          </motion.div>
        </div>

        {/* 横线 */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6 }}
          className="flex justify-end"
        >
          <div style={{ width: `${(maxLength + 2) * 56}px` }} className="border-b-2 border-gray-800 origin-right" />
        </motion.div>

        {/* 部分积 */}
        {completedRows.map((multiplierIndex) => {
          const rowData = getRowDigits(multiplierIndex);
          const rowKey = `row-${multiplierIndex}`;
          const rowPosition = num2Str.length - 1 - multiplierIndex;
          const L = rowData.digits.length;
          
          return (
            <div key={rowKey}>
              {/* 部分积数字 */}
              <div className="flex justify-end items-center gap-8">
                <div className="text-gray-400 text-sm w-24 text-right">
                  {num1} × {num2Str[multiplierIndex]}
                </div>
                <div className="flex gap-2">
                  <span className="w-12" />
                  {/* 补齐左侧空位 */}
                  {Array(Math.max(0, additionResultLength - L - rowPosition)).fill(0).map((_, i) => (
                    <span key={`${rowKey}-left-pad-${i}`} className="w-12" />
                  ))}
                  {rowData.digits.map((digit, i) => {
                    // 计算该数字在最终结果中的列索引（从右到左，0是个位）
                    const digitColumnIndex = rowPosition + (L - 1 - i);
                    const isHighlighted = highlightColumn !== null && digitColumnIndex === highlightColumn;
                    
                    return (
                      <motion.span
                        key={digit.id}
                        initial={freshDigitsRef.current.has(digit.id) ? { scale: 0 } : { scale: 1 }}
                        animate={{ scale: 1 }}
                        className={`w-12 text-center transition-all duration-300 ${isHighlighted ? 'bg-orange-200 text-orange-900 rounded scale-110' : 'text-indigo-600'}`}
                      >
                        {digit.value}
                      </motion.span>
                    );
                  })}
                  {Array(rowPosition).fill(0).map((_, i) => {
                    // 补0的部分，从右到左的列索引
                    const digitColumnIndex = rowPosition - 1 - i;
                    const isHighlighted = highlightColumn !== null && digitColumnIndex === highlightColumn;
                    
                    return (
                      <span 
                        key={`${rowKey}-pad-${i}`} 
                        className={`w-12 text-center transition-all duration-300 ${isHighlighted ? 'bg-orange-200 text-orange-900 rounded scale-110' : 'text-gray-400'}`}
                      >
                        0
                      </span>
                    );
                  })}
                </div>
              </div>
              
              {/* 该行的进位显示 - 只显示当前使用的进位，避免重叠 */}
              <div className="flex justify-end items-center gap-8 h-16">
                <div className="text-gray-400 text-sm w-24 text-right"></div>
                <div className="flex gap-2 relative">
                  <span className="w-12" />
                  {/* 显示该行的乘法进位 - 只显示当前使用的进位 */}
                  {/* 进位要放置在最终被加总到的数位竖向对齐的位置 */}
                  {/* 与数字显示保持相同的布局结构，确保进位对齐 */}
                  {/* 补齐左侧空位 */}
                  {Array(Math.max(0, additionResultLength - L - rowPosition)).fill(0).map((_, i) => (
                    <span key={`${rowKey}-left-pad-${i}`} className="w-12" />
                  ))}
                  {/* 部分积数字位置，用于显示进位 */}
                  {/* 进位显示位置，与数字显示位置对应 */}
                  {/* 数字显示顺序：从左到右（高位到低位） */}
                  {/* 进位显示顺序：从右到左（低位到高位） */}
                  {/* 进位显示在它将要被加总到的数位下方 */}
                  {/* 遍历所有可能的进位位置，从右到左（低位到高位） */}
                  {/* 为每个可能的进位位置创建一个容器 */}
                  {/* 反转遍历顺序，确保低位进位显示在右侧，高位进位显示在左侧 */}
                  {[...Array(num1Str.length + 1).keys()].reverse().map((i) => {
                    // i 是显示位置索引（从左到右，0是高位）
                    // 反转后，i 现在是从 num1Str.length 递减到 0
                    let carry = 0;
                    let isActiveCarry = false;
                    
                    // 计算从右到左的位置索引
                    const reverseIndex = num1Str.length - i;
                    
                    // 查找该位置是否有进位
                    for (const key in currentCarries) {
                      const [mIdx, keyMcIdx] = key.split('-').map(Number);
                      if (mIdx === multiplierIndex) {
                        // keyMcIdx 是进位将要被使用的数位索引（从右到左，0是个位）
                        // 例如：keyMcIdx=1 表示进位要加到十位
                        // 显示位置：从右到左第 keyMcIdx 位
                        if (keyMcIdx === reverseIndex + 1) {
                          carry = currentCarries[key];
                          
                          // 检查是否是当前活跃的进位
                          if (currentStepIndex < multiplicationSteps.length) {
                            const currentMultiplicationStep = multiplicationSteps[currentStepIndex];
                            isActiveCarry = currentMultiplicationStep.multiplierIndex === multiplierIndex &&
                                            currentMultiplicationStep.multiplicandIndex === keyMcIdx - 1;
                          }
                          break;
                        }
                      }
                    }
                    
                    return (
                      <motion.div
                        key={`${rowKey}-carry-${i}`}
                        className="w-12 relative"
                      >
                        {/* 动态进位显示 - 明显的入场和退场动画 */}
                        {carry > 0 && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0, y: -30 }}
                            animate={{
                              opacity: 1,
                              scale: isActiveCarry ? 1.5 : 1,
                              y: 0,
                              rotate: [0, -5, 5, -5, 0] // 添加旋转效果，增强动态感
                            }}
                            exit={{ 
                              opacity: 0, 
                              scale: 0, 
                              y: 30,
                              x: -20
                            }}
                            transition={{ type: 'spring', stiffness: 300, duration: 0.6, rotate: { duration: 0.8 } }}
                            className="absolute top-0 left-1/2 transform -translate-x-1/2 text-center"
                          >
                            {/* 进位数值 - 红色，加粗，放大 */}
                            <span className="text-red-600 font-bold text-2xl">
                              {carry}
                            </span>
                            
                            {/* 动态箭头指示进位方向 - 更明显的动画 */}
                            <motion.span
                              className="absolute -right-6 top-1/2 transform -translate-y-1/2 text-red-600 font-bold"
                              initial={{ opacity: 0, scale: 0, x: -10 }}
                              animate={{ opacity: 1, scale: [1, 1.5, 1], x: [0, 10, 0] }}
                              exit={{ opacity: 0, scale: 0 }}
                              transition={{ delay: 0.3, repeat: Infinity, repeatDelay: 0.8, duration: 0.6 }}
                            >
                              ←
                            </motion.span>
                            
                            {/* 动态闪光效果 - 更明显的脉动 */}
                            {isActiveCarry && (
                              <motion.div
                                className="absolute -inset-3 rounded-full bg-red-300 opacity-40"
                                initial={{ scale: 0 }}
                                animate={{ scale: [1, 1.8, 1], opacity: [0, 0.6, 0] }}
                                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.4 }}
                              />
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                  {/* 补0的部分，不显示进位 */}
                  {Array(rowPosition).fill(0).map((_, i) => (
                    <span key={`${rowKey}-pad-${i}`} className="w-12" />
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* 加法横线 */}
        {currentStepIndex >= multiplicationSteps.length + 1 && (
          <>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              className="flex justify-end"
            >
              <div style={{ width: `${(additionResultLength + 1) * 56}px` }} className="border-b-2 border-gray-800 origin-right" />
            </motion.div>

            {/* 加法进位显示（在加法结果上方） */}
            <div className="flex justify-end items-center gap-8 h-8">
              <div className="text-gray-400 text-sm w-24 text-right">进位</div>
              <div className="flex gap-2">
                <span className="w-12" />
                {Array(additionResultLength).fill(0).map((_, i) => {
                  // i 从左到右（0是最高位），columnIndex 从右到左（0是个位）
                  const columnIndex = additionResultLength - 1 - i;
                  const carry = additionCarries[columnIndex] || 0;
                  const isCurrentColumn = highlightColumn === columnIndex;
                  
                  return (
                    <motion.span
                      key={`add-carry-${i}`}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{
                        opacity: carry > 0 ? 1 : 0,
                        y: 0,
                        scale: isCurrentColumn ? 1.5 : 1
                      }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{
                        scale: { duration: 0.3 },
                        opacity: { duration: 0.3 }
                      }}
                      className="w-12 text-center text-red-600 font-bold text-2xl"
                    >
                      {carry > 0 && (
                        <>
                          <span>{carry}</span>
                          {/* 箭头指示进位方向 */}
                          <motion.span
                            className="absolute -right-2 top-1/2 transform -translate-y-1/2 text-red-600"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            ←
                          </motion.span>
                        </>
                      )}
                    </motion.span>
                  );
                })}
              </div>
            </div>

            {/* 加法步骤 */}
            <div className="flex justify-end items-center gap-8">
              <div className="text-gray-400 text-sm w-24 text-right">加总</div>
              <div className="flex gap-2">
                <span className="w-12" />
                {Array(additionResultLength).fill(0).map((_, i) => {
                  // i 从左到右（0是最高位），columnIndex 从右到左（0是个位）
                  const columnIndex = additionResultLength - 1 - i;
                  const hasBeenCalculated = columnIndex < finalResultDigits.length;
                  const digit = hasBeenCalculated ? finalResultDigits[columnIndex]?.value ?? '' : '';
                  const isHighlighted = highlightColumn !== null && columnIndex === highlightColumn;
                  
                  return (
                    <motion.span
                      key={`addition-digit-${i}`}
                      initial={{
                        opacity: hasBeenCalculated ? 0 : 1,
                        scale: hasBeenCalculated ? 0 : 1
                      }}
                      animate={{
                        opacity: hasBeenCalculated ? 1 : 1,
                        scale: 1,
                        backgroundColor: highlightColumn === columnIndex ? '#fef3c7' : 'transparent'
                      }}
                      transition={{
                        scale: { type: 'spring', stiffness: 300 },
                        backgroundColor: { duration: 0.3 }
                      }}
                      className={`w-12 text-center transition-all duration-300 ${highlightColumn === columnIndex ? 'bg-yellow-100 text-yellow-900 rounded scale-110' : hasBeenCalculated ? 'text-indigo-700 font-bold' : 'text-transparent'}`}
                    >
                      {digit}
                    </motion.span>
                  );
                })}
              </div>
            </div>

            {/* 加法过程中的临时进位显示 */}
            <div className="flex justify-end items-center gap-8 h-8">
              <div className="text-gray-400 text-sm w-24 text-right">结果进位</div>
              <div className="flex gap-2">
                <span className="w-12" />
                {Array(additionResultLength + 1).fill(0).map((_, i) => {
                  // i 从左到右（0是最高位），columnIndex 从右到左（0是个位）
                  const columnIndex = additionResultLength - i;
                  const isCurrentColumn = highlightColumn === columnIndex - 1;
                  const carry = additionCarries[columnIndex] || 0;
                  
                  return (
                    <motion.span
                      key={`add-temp-carry-${i}`}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: carry > 0 && isCurrentColumn ? 1 : 0,
                        scale: carry > 0 && isCurrentColumn ? 1.5 : 0,
                        x: carry > 0 && isCurrentColumn ? 0 : 10
                      }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300
                      }}
                      className="w-12 text-center text-red-600 font-bold text-2xl"
                    >
                      {carry > 0 && isCurrentColumn && carry}
                    </motion.span>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 最终结果的横线 */}
        {currentStepIndex >= multiplicationSteps.length + 1 + additionSteps.length && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            className="flex justify-end"
          >
            <div style={{ width: `${(maxLength + 2) * 56}px` }} className="border-b-2 border-gray-800 origin-right" />
          </motion.div>
        )}

        {/* 最终结果 */}
        {currentStepIndex >= multiplicationSteps.length + 1 + additionSteps.length + 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="flex justify-end items-center gap-8"
          >
            <div className="text-gray-400 text-sm w-24 text-right">结果</div>
            <div className="flex gap-2">
              <span className="w-12" />
              {[...finalResultDigits].reverse().map((digit) => (
                <span
                  key={digit.id}
                  className="w-12 text-center bg-green-100 text-green-700 rounded py-1"
                >
                  {digit.value}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* 步骤指示器 */}
      <div className="mt-8 flex gap-2 flex-wrap justify-center max-w-2xl">
        {Array(totalSteps).fill(0).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{
              scale: i === currentStepIndex ? 1.25 : 1,
              backgroundColor: i < currentStepIndex ? '#4f46e5' : i === currentStepIndex ? '#818cf8' : '#d1d5db'
            }}
            transition={{
              type: 'spring',
              stiffness: 300
            }}
            className={`w-3 h-3 rounded-full transition-all duration-300`}
          />
        ))}
      </div>
      
      <div className="mt-4 text-gray-800 text-center font-medium p-4 bg-gray-50 rounded-lg max-w-2xl mx-auto">
        {currentStepIndex === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg"
          >
            准备开始计算 <span className="text-indigo-600 font-bold">{num1}</span> × <span className="text-indigo-600 font-bold">{num2}</span>
          </motion.div>
        )}
        {currentStepIndex > 0 && currentStepIndex <= multiplicationSteps.length && (() => {
          const step = multiplicationSteps[currentStepIndex - 1];
          const multiplierDigit = num2Str[step.multiplierIndex];
          const multiplicandDigit = step.multiplicandIndex >= 0 ? num1Str[step.multiplicandIndex] : '';
          
          if (step.multiplicandIndex >= 0) {
            if (step.usedCarry > 0) {
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  步骤 {currentStepIndex}: <span className="text-blue-600 font-bold">{multiplicandDigit}</span> × <span className="text-yellow-600 font-bold">{multiplierDigit}</span> + 
                  进位 <span className="text-red-600 font-bold text-2xl">{step.usedCarry}</span> = <span className="text-green-600 font-bold">{step.result}</span>
                  <br />
                  <span className="text-sm text-gray-500">（{step.result} = {multiplicandDigit}×{multiplierDigit} + {step.usedCarry}，显示 {step.displayDigit}，进位 {step.carry}）</span>
                </motion.div>
              );
            } else {
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  步骤 {currentStepIndex}: <span className="text-blue-600 font-bold">{multiplicandDigit}</span> × <span className="text-yellow-600 font-bold">{multiplierDigit}</span> = <span className="text-green-600 font-bold">{step.result}</span>
                  <br />
                  <span className="text-sm text-gray-500">（{step.result} = {multiplicandDigit}×{multiplierDigit}，显示 {step.displayDigit}，进位 {step.carry}）</span>
                </motion.div>
              );
            }
          } else {
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                步骤 {currentStepIndex}: <span className="text-red-600 font-bold">进位</span> <span className="text-green-600 font-bold">{step.displayDigit}</span>
              </motion.div>
            );
          }
        })()}
        {currentStepIndex === multiplicationSteps.length + 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="text-lg"
          >
            <span className="text-indigo-600 font-bold">乘法完成！</span> 现在开始 <span className="text-red-600 font-bold">加总</span> 所有部分积
          </motion.div>
        )}
        {currentStepIndex > multiplicationSteps.length + 1 && currentStepIndex <= multiplicationSteps.length + 1 + additionSteps.length && (() => {
          const additionIndex = currentStepIndex - multiplicationSteps.length - 2;
          if (additionIndex < 0 || additionIndex >= additionSteps.length) {
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                正在计算...
              </motion.div>
            );
          }
          
          const step = additionSteps[additionIndex];
          if (!step) return '正在计算...';
          
          const column = step.columnIndex;
          const values = step.values;
          const usedCarry = step.usedCarry;
          const sum = step.sum;
          const displayDigit = step.displayDigit;
          const carry = step.carry;
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              步骤 {currentStepIndex}: 列 {column+1} 相加
              <br />
              <span className="text-blue-600">{values.join(' + ')}</span>
              {usedCarry > 0 && <span> + 进位 <span className="text-red-600 font-bold text-2xl">{usedCarry}</span></span>}
              = <span className="text-green-600 font-bold">{sum}</span>
              <br />
              <span className="text-sm text-gray-500">（显示 <span className="text-green-600 font-bold">{displayDigit}</span>，进位 <span className="text-red-600 font-bold text-2xl">{carry}</span>）</span>
            </motion.div>
          );
        })()}
        {currentStepIndex === multiplicationSteps.length + 1 + additionSteps.length + 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', bounce: 0.3 }}
            className="text-lg"
          >
            <span className="text-green-600 font-bold">计算完成！</span>
            <br />
            {num1} × {num2} = <span className="text-2xl text-indigo-600 font-bold">{finalResult}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}