import React from 'react';
import { FileText } from 'lucide-react';
import { PostLiveReport as PostLiveReportData } from '../types/liveRadar';

interface PostLiveReportProps {
  report: PostLiveReportData;
}

export const PostLiveReport: React.FC<PostLiveReportProps> = ({ report }) => {
  return (
    <section className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-rose-300" />
        <div>
          <h3 className="text-sm font-extrabold text-white">{report.title}</h3>
          <p className="text-[10px] text-slate-500">{report.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {report.sections.map((section) => (
          <div key={section.title} className="rounded-lg bg-slate-950/70 border border-slate-800 p-3 min-h-[118px]">
            <p className="text-[11px] font-extrabold text-slate-100 mb-2">{section.title}</p>
            <ul className="space-y-1.5">
              {section.items.slice(0, 2).map((item, index) => (
                <li key={`${section.title}-${index}`} className="text-[10px] text-slate-400 leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};
