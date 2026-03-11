import React, { useRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Camera, Image as ImageIcon, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

export default function UploadZone({ onFileUpload }) {
  const { t } = useTranslation(['dashboard']);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = [...e.dataTransfer.files];
    if (files.length > 0) {
      onFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const files = [...e.target.files];
    if (files.length > 0) {
      onFileUpload(files[0]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-2 gap-8 p-8">
            {/* Drag & Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
                dragActive 
                  ? "border-blue-400 bg-blue-50" 
                  : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                  <Upload className="w-10 h-10 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {t('uploadZone.dragDropChart', { ns: 'dashboard' })}
                </h3>
                <p className="text-slate-600 mb-6">
                  {t('uploadZone.dropChartHere', { ns: 'dashboard' })}
                </p>
                
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  {t('uploadZone.browseFiles', { ns: 'dashboard' })}
                </Button>
                
                <p className="text-xs text-slate-400 mt-4">
                  {t('uploadZone.supportedFormats', { ns: 'dashboard' })}
                </p>
              </div>
            </div>

            {/* Camera Option */}
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:border-purple-400 hover:bg-purple-50/50 transition-all duration-300">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                  <Camera className="w-10 h-10 text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {t('uploadZone.useCamera', { ns: 'dashboard' })}
                </h3>
                <p className="text-slate-600 mb-6">
                  {t('uploadZone.takePhoto', { ns: 'dashboard' })}
                </p>
                
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 shadow-lg"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  {t('uploadZone.openCamera', { ns: 'dashboard' })}
                </Button>
                
                <p className="text-xs text-slate-400 mt-4">
                  {t('uploadZone.perfectForMobile', { ns: 'dashboard' })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}