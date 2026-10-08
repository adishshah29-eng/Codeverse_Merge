import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { 
  Play, Cpu, Database, BarChart3, CheckCircle, AlertCircle, 
  Sparkles, Award, Code2, LineChart
} from "lucide-react";
import { game5Api } from "../api";

const DEFAULT_STARTER_CODE = `import pandas as pd
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

# ── ROYAL MINT ML STUDIO // PRINTING PRESS ───────────────────
# Available in environment: train_df (7,000 rows) and test_df (1,500 rows)
# Target column: 'amount_printed'

# 1. Feature selection & preprocessing
features = [c for c in train_df.columns if c not in ("id", "amount_printed")]
X_train = pd.get_dummies(train_df[features], drop_first=True)
y_train = train_df["amount_printed"]

X_test = pd.get_dummies(test_df[features], drop_first=True)
X_test = X_test.reindex(columns=X_train.columns, fill_value=0)

# 2. Impute any missing telemetry
imputer = SimpleImputer(strategy="median")
X_train_imp = imputer.fit_transform(X_train)
X_test_imp = imputer.transform(X_test)

# 3. Fit Gradient Boosted Trees
model = HistGradientBoostingRegressor(random_state=2026, max_iter=150)
model.fit(X_train_imp, y_train)

# 4. Generate Predictions for test.csv (len must be 1500)
predictions = model.predict(X_test_imp)

print(f"[MODEL TRAINED] Generated {len(predictions)} predictions.")
`;

export default function Game5PrintingPress({ onStageComplete, dashboard, onRefresh }) {
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [code, setCode] = useState(DEFAULT_STARTER_CODE);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [activeTab, setActiveTab] = useState("editor");

  useEffect(() => {
    loadDatasetInfo();
  }, []);

  const loadDatasetInfo = async () => {
    try {
      const data = await game5Api.getInfo();
      setDatasetInfo(data);
    } catch (err) {
      console.error("Failed to load ML info:", err);
    }
  };

  const handleTestRun = async () => {
    setRunning(true);
    setEvalResult(null);
    try {
      const res = await game5Api.runModel(code);
      setEvalResult(res);
    } catch (err) {
      setEvalResult({ passed: false, message: `Run failed: ${err.message}` });
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitFinalModel = async () => {
    setSubmitting(true);
    setEvalResult(null);

    const idempotencyKey = `g5-${Date.now()}`;
    try {
      const res = await game5Api.submit({
        idempotency_key: idempotencyKey,
        code: code
      });
      setEvalResult({
        passed: res.passed,
        message: res.message,
        error_pct: res.feedback?.error_pct,
        image: res.feedback?.image,
        score_awarded: res.score_awarded
      });
      if (res.passed) {
        await onRefresh();
        // The Royal Mint heist ends here; the Challenge Arena (stage 6) unlocks next.
        setTimeout(() => onStageComplete(res.next_stage || 6), 3500);
      }
    } catch (err) {
      setEvalResult({ passed: false, message: err.message || "Model evaluation failed." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-rise">
      
      {/* Stage Header */}
      <div className="p-5 rounded-2xl glass-panel-glow border border-[#D2362B]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans text-amber-400 font-bold uppercase tracking-wider">
            <span className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/40">STAGE 05</span>
            <span>MACHINE LEARNING REGRESSION BENCHMARK</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-semibold text-white tracking-tight mt-1">
            Printing Press: Machine Learning Studio
          </h2>
          <p className="text-xs text-gray-400 font-sans mt-1 max-w-2xl">
            Predict the industrial currency print yield (<span className="text-[#E9DFCB]">amount_printed</span>). Train your model on the 7,000-row dataset and predict test values.
            Scored directly against the private server answer key (<span className="text-[#E9DFCB]">&le; 2% error = 10.0 pts</span>).
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-[#161210] border border-[#352D27] text-center font-sans">
          <div className="text-[10px] text-gray-400 uppercase">Max Score</div>
          <div className="text-sm font-extrabold text-[#E9DFCB]">10.00 pts</div>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Editor Canvas (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-panel rounded-2xl border border-[#352D27] overflow-hidden flex flex-col h-[560px]">
            
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0A0807] border-b border-[#352D27]">
              <div className="flex items-center gap-2 text-xs font-sans text-gray-300">
                <Code2 className="w-4 h-4 text-[#E9DFCB]" />
                <span className="font-bold">printing_press_model.py</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161210] text-emerald-400 border border-[#352D27]">
                  Scikit-Learn &bull; Pandas
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={running || submitting}
                  onClick={handleTestRun}
                  className="px-3.5 py-1.5 rounded-lg bg-[#161210] hover:bg-[#1F1A17] border border-[#E9DFCB]/40 text-[#E9DFCB] text-xs font-sans font-bold flex items-center gap-1.5 transition"
                >
                  <Play className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
                  {running ? "Training..." : "Test Run"}
                </button>
                <button
                  type="button"
                  disabled={submitting || running}
                  onClick={handleSubmitFinalModel}
                  className="px-4 py-1.5 rounded-lg bg-red text-white text-xs font-sans font-bold flex items-center gap-1.5 transition"
                >
                  <Award className="w-3.5 h-3.5" />
                  {submitting ? "Scoring..." : "Submit for Benchmark"}
                </button>
              </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 bg-[#0A0807]">
              <Editor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || "")}
                options={{
                  fontSize: 13,
                  fontFamily: "JetBrains Mono, monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>

          </div>
        </div>

        {/* Right Info & Benchmark Telemetry (4 Cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col h-[560px]">
          
          {/* Dataset Info Card */}
          <div className="glass-panel p-4 rounded-xl border border-[#352D27] text-xs font-sans space-y-2">
            <h4 className="font-bold text-gray-200 uppercase flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#E9DFCB]" />
              Industrial Dataset Telemetry
            </h4>
            <div className="grid grid-cols-2 gap-2 text-center pt-1">
              <div className="p-2 rounded bg-[#0A0807] border border-[#352D27]">
                <div className="text-[10px] text-gray-500">Train Rows</div>
                <div className="text-sm font-bold text-white">7,000</div>
              </div>
              <div className="p-2 rounded bg-[#0A0807] border border-[#352D27]">
                <div className="text-[10px] text-gray-500">Test Predictions</div>
                <div className="text-sm font-bold text-[#E9DFCB]">1,500</div>
              </div>
            </div>
          </div>

          {/* Benchmark Score Tiers */}
          <div className="glass-panel p-4 rounded-xl border border-[#352D27] text-xs font-sans space-y-2">
            <h4 className="font-bold text-gray-200 uppercase flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Scoring Accuracy Brackets
            </h4>
            <div className="space-y-1 text-[11px] text-gray-400">
              <div className="flex justify-between py-0.5 border-b border-[#352D27]">
                <span>&le; 2.0% Overall Error</span>
                <span className="text-emerald-400 font-bold">10.0 pts</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#352D27]">
                <span>&le; 5.0% Overall Error</span>
                <span className="text-emerald-400 font-bold">9.5 pts</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#352D27]">
                <span>&le; 10.0% Overall Error</span>
                <span className="text-[#E9DFCB] font-bold">8.5 pts</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-[#352D27]">
                <span>&le; 20.0% Overall Error</span>
                <span className="text-amber-400 font-bold">6.0 pts</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>&gt; 50.0% Error</span>
                <span className="text-rose-400 font-bold">0.0 pts</span>
              </div>
            </div>
          </div>

          {/* Execution & Benchmark Results Panel */}
          <div className="glass-panel p-4 rounded-xl border border-[#352D27] flex-1 overflow-y-auto font-sans text-xs space-y-3">
            <h4 className="font-bold text-gray-200 uppercase flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#E9DFCB]" />
              Evaluation Benchmark Feedback
            </h4>

            {evalResult ? (
              <div className="space-y-3 animate-rise">
                <div className={`p-3 rounded-lg border ${
                  evalResult.passed 
                    ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300" 
                    : "bg-rose-950/60 border-rose-500/50 text-rose-300"
                }`}>
                  <div className="font-bold flex items-center gap-1.5 mb-1">
                    {evalResult.passed ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                    {evalResult.passed ? "MODEL BENCHMARKED!" : "VALIDATION FAILED"}
                  </div>
                  <p>{evalResult.message}</p>
                  {evalResult.score_awarded !== undefined && (
                    <div className="mt-2 text-base font-bold text-[#E9DFCB]">
                      Score Awarded: +{evalResult.score_awarded} / 10.0 pts
                    </div>
                  )}
                </div>

                {evalResult.image && (
                  <div>
                    <span className="text-[10px] text-gray-400 block mb-1">Telemetry Plot Captured:</span>
                    <img 
                      src={`data:image/png;base64,${evalResult.image}`} 
                      alt="Telemetry Plot" 
                      className="w-full rounded-lg border border-[#352D27]"
                    />
                  </div>
                )}

                {evalResult.stdout && (
                  <div className="p-2.5 rounded bg-[#0A0807] border border-[#352D27] text-gray-300 whitespace-pre-wrap font-mono text-[11px]">
                    {evalResult.stdout}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 italic">
                Press [Test Run] to verify code execution, or [Submit for Benchmark] to officially record points on the tournament leaderboard.
              </p>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
