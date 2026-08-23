import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const faqs = [
  {
    question: 'Who can create an account on the CHATEAU App?',
    answer:
      'Access is strictly limited to verified residents and HOA officers of Chateau Real Executive Village. Every account is validated against official homeowner records before activation, so there are no outsiders and no exceptions.',
  },
  {
    question: 'How do I reserve a facility?',
    answer:
      'Head to the Facilities section, browse available amenities with panorama visualization, pick your preferred date and time slot, then submit your reservation for approval by the HOA board.',
  },
  {
    question: 'How can I track or pay my HOA dues?',
    answer:
      'The Payments section shows your current balance, payment history, and due dates in real time, so you always know exactly where you stand.',
  },
  {
    question: 'How do I report an issue in the neighborhood?',
    answer:
      'Use the Reports feature to submit a concern directly to your HOA board, complete with details and photos, and track its status until it is resolved.',
  },
  {
    question: 'Can I vote in community elections through the app?',
    answer:
      'Yes. During election periods, eligible residents can view candidates and cast their vote securely from the Elections tab, right from their phone.',
  },
  {
    question: 'Is my data safe on the CHATEAU App?',
    answer:
      'Resident data, financial records, and community communications are kept confidential and are never shared beyond the Chateau community, the same trust and security you feel at our gates extends to every interaction on the app.',
  },
  {
    question: 'What if I forget my password or need help with my account?',
    answer:
      'Reach out to the HOA office or message the Chateau Real Facebook page, and an officer will assist you with account recovery or any other concern.',
  },
];

const FAQs = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (i) => setOpenIndex((prev) => (prev === i ? -1 : i));

  return (
    <section id="faqs" className="py-28 bg-white overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#006837]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#FFF200]/10 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 lg:px-16 relative z-10 max-w-3xl">

        {/* Header */}
        <div className="text-center mb-16 reveal">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#006837]/10 border border-[#006837]/20 rounded-full text-[#006837] text-xs font-black uppercase tracking-widest mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006837]" />
            Got Questions?
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
            Frequently Asked <span className="text-[#006837]">Questions</span>
          </h2>
          <p className="max-w-xl mx-auto text-slate-500 text-base leading-relaxed">
            Everything you need to know about using the CHATEAU App as a resident of Chateau Real Executive Village.
          </p>
        </div>

        {/* Accordion */}
        <div className="flex flex-col gap-4 reveal">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={faq.question}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen ? 'border-[#006837]/30 bg-[#006837]/5' : 'border-slate-200 bg-slate-50 hover:border-[#006837]/20'
                }`}>
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer">
                  <span className="flex items-center gap-3 font-bold text-slate-900 text-base">
                    <HelpCircle size={18} className={isOpen ? 'text-[#006837]' : 'text-slate-400'} />
                    {faq.question}
                  </span>
                  <ChevronDown size={20}
                    className={`shrink-0 text-[#006837] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 pl-[2.9rem] text-slate-600 text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQs;
