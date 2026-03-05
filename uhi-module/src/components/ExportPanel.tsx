import { Download, FileImage, FileSpreadsheet, Map } from 'lucide-react';
import { toast } from 'sonner';
// @ts-ignore - papaparse lacks type definitions
import Papa from 'papaparse';

interface ExportPanelProps {
  zones?: any[];
}

const ExportPanel = ({ zones }: ExportPanelProps) => {
  const exportToCSV = (data: any[], filename: string) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    toast.success(`${filename} exported successfully!`);
  };

  const exportToGeoJSON = (zones: any[], filename: string) => {
    const geoJSON = {
      type: 'FeatureCollection',
      features: zones.map(zone => ({
        type: 'Feature',
        properties: {
          id: zone.id,
          name: zone.name,
          lst: zone.lst,
          uhiClass: zone.uhiClass,
          ndvi: zone.ndvi,
          ndbi: zone.ndbi,
          area: zone.area,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [zone.coordinates],
        },
      })),
    };
    
    const blob = new Blob([JSON.stringify(geoJSON, null, 2)], { 
      type: 'application/json' 
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.geojson`;
    link.click();
    toast.success(`${filename} exported successfully!`);
  };

  const exportGeoTIFFLayer = async (layerName: string) => {
    toast.info('Downloading original GeoTIFF file...');
    // In a real implementation, you would fetch and download the original GeoTIFF
    const link = document.createElement('a');
    link.href = `/data/Idukki_${layerName}.tif`;
    link.download = `Idukki_${layerName}.tif`;
    link.click();
  };

  const handleExport = (type: string, format: string) => {
    try {
      if (type === 'LST Data') {
        if (format === 'CSV' && zones) {
          const lstData = zones.map(z => ({
            id: z.id,
            name: z.name,
            latitude: z.coordinates[0][0],
            longitude: z.coordinates[0][1],
            lst_celsius: z.lst,
          }));
          exportToCSV(lstData, 'Thodupuzha_LST_Data');
        } else if (format === 'GeoTIFF') {
          exportGeoTIFFLayer('LST');
        }
      } else if (type === 'UHI Zones') {
        if (format === 'GeoJSON' && zones) {
          exportToGeoJSON(zones, 'Thodupuzha_UHI_Zones');
        } else if (format === 'Shapefile') {
          toast.info('Shapefile export requires GIS software conversion');
        }
      } else if (type === 'NDVI Data') {
        if (format === 'CSV' && zones) {
          const ndviData = zones.map(z => ({
            id: z.id,
            name: z.name,
            latitude: z.coordinates[0][0],
            longitude: z.coordinates[0][1],
            ndvi: z.ndvi,
          }));
          exportToCSV(ndviData, 'Thodupuzha_NDVI_Data');
        } else if (format === 'GeoTIFF') {
          exportGeoTIFFLayer('NDVI');
        }
      } else if (type === 'NDBI Data') {
        if (format === 'CSV' && zones) {
          const ndbiData = zones.map(z => ({
            id: z.id,
            name: z.name,
            latitude: z.coordinates[0][0],
            longitude: z.coordinates[0][1],
            ndbi: z.ndbi,
          }));
          exportToCSV(ndbiData, 'Thodupuzha_NDBI_Data');
        } else if (format === 'GeoTIFF') {
          exportGeoTIFFLayer('NDBI');
        }
      } else if (type === 'Full Report') {
        if (format === 'Excel' || format === 'PDF') {
          const reportData = zones?.map(z => ({
            ID: z.id,
            Name: z.name,
            'LST (°C)': z.lst,
            'UHI Class': z.uhiClass,
            NDVI: z.ndvi,
            NDBI: z.ndbi,
            'Area (sq km)': z.area,
          })) || [];
          
          if (format === 'Excel') {
            exportToCSV(reportData, 'Thodupuzha_Full_Report');
          } else {
            toast.info('PDF export requires additional library');
          }
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed. Please try again.');
    }
  };

  const exportOptions = [
    { 
      type: 'LST Data', 
      icon: FileImage, 
      formats: ['GeoTIFF', 'CSV'],
      color: 'text-lst',
      bgColor: 'bg-lst/10'
    },
    { 
      type: 'UHI Zones', 
      icon: Map, 
      formats: ['GeoJSON', 'Shapefile'],
      color: 'text-uhi-high',
      bgColor: 'bg-uhi-high/10'
    },
    { 
      type: 'NDVI Data', 
      icon: FileImage, 
      formats: ['GeoTIFF', 'CSV'],
      color: 'text-ndvi',
      bgColor: 'bg-ndvi/10'
    },
    { 
      type: 'NDBI Data', 
      icon: FileImage, 
      formats: ['GeoTIFF', 'CSV'],
      color: 'text-ndbi',
      bgColor: 'bg-ndbi/10'
    },
    { 
      type: 'Full Report', 
      icon: FileSpreadsheet, 
      formats: ['PDF', 'Excel'],
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
  ];

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-1">Export Data</h2>
        <p className="text-sm text-muted-foreground">Download layers and reports</p>
      </div>
      
      {exportOptions.map(({ type, icon: Icon, formats, color, bgColor }) => (
        <div key={type} className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${bgColor} ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{type}</span>
          </div>
          <div className="flex gap-2">
            {formats.map((format) => (
              <button
                key={format}
                onClick={() => handleExport(type, format)}
                className="export-btn flex-1 text-xs justify-center"
              >
                <Download className="w-3 h-3" />
                {format}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExportPanel;
