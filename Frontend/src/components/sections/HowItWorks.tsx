"use client";

import React from "react";
import { motion } from "framer-motion";
import { Download, Power, Shield } from "lucide-react";

const steps = [
    {
        icon: <Download className="w-8 h-8" />,
        number: "01",
        title: "ACQUIRE",
        description: "Install the NISHA sensor app. iOS or Android. Secure 45MB package. Military-grade encryption.",
    },
    {
        icon: <Power className="w-8 h-8" />,
        number: "02",
        title: "ACTIVATE",
        description: "Enable your sensors. Audio detection. Video intelligence. You control every permission.",
    },
    {
        icon: <Shield className="w-8 h-8" />,
        number: "03",
        title: "PROTECT",
        description: "Your device joins the mesh. Detect threats. Alert your community. Sleep soundly.",
    },
];

export const HowItWorks = () => {
    return (
        <section id="how-it-works" className="py-24 bg-surface/30 relative overflow-hidden">
            <div className="container px-6 mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-4xl md:text-5xl font-display mb-4">INITIALIZATION SEQUENCE</h2>
                    <div className="w-24 h-[1px] bg-primary/30 mx-auto" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.2 }}
                            whileHover={{ y: -5 }}
                            className="bg-surface/70 backdrop-blur-xl border border-foreground/10 p-8 rounded-xl relative group"
                        >
                            <div className="text-primary mb-6 transition-transform duration-500 group-hover:scale-110">
                                {step.icon}
                            </div>
                            <div className="absolute top-6 right-8 text-5xl font-display font-black text-primary/5 select-none italic group-hover:text-primary/10 transition-colors">
                                {step.number}
                            </div>
                            <h3 className="text-2xl font-display mb-4 text-foreground uppercase tracking-wider">{step.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};
