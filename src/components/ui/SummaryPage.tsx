import { FC } from 'react';
import { ToothCustomization } from '../../lib/types';
import { pricingConfig } from '../../lib/pricingConfig';

interface SummaryPageProps {
  totalCost: number;
  customizations: ToothCustomization[];
  onBack: () => void;
}

const SummaryPage: FC<SummaryPageProps> = ({
  totalCost,
  customizations,
  onBack,
}) => {
  // Build itemized list of customizations
  const items = customizations
    .map((c, i) => {
      const matCost =
        c.material !== 'default'
          ? pricingConfig.materials[c.material].costPerTooth
          : 0;
      const diaCost = c.hasDiamonds ? pricingConfig.diamonds.costPerTooth : 0;
      // Format customization: capitalize material or variant
      const name = c.variant ?? c.material;
      const text = name.charAt(0).toUpperCase() + name.slice(1);
      const customization = c.hasDiamonds ? `${text} 💎` : text;
      return {
        tooth: i + 1,
        customization,
        cost: matCost + diaCost,
      };
    })
    .filter((item) => item.cost > 0);

  return (
    <div className="relative h-screen bg-gray-100 overflow-hidden md:flex md:items-center md:justify-center">
      <div
        className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-[380px] bg-white rounded-t-2xl shadow-2xl p-6 flex flex-col gap-4 border border-gray-100
                    md:static md:transform-none md:max-w-3xl md:rounded-2xl md:p-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            aria-label="Back"
            className="text-2xl p-1 text-gray-600 hover:text-gray-800 focus:outline-none"
          >
            ←
          </button>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-800">
            Summary
          </h2>
          <div className="w-6" />
        </div>
        {/* Layout: Screenshot & Cart Details */}
        <div className="mt-4 flex flex-col md:flex-row md:space-x-8">
          {/* Screenshot Preview */}
          <div className="w-full md:w-1/2 h-40 md:h-auto bg-gray-100 rounded-lg border border-gray-300 overflow-hidden flex items-center justify-center">
            {/* TODO: Render screenshot here */}
            <span className="text-gray-500">Screenshot</span>
          </div>
          {/* Cart Details & Actions */}
          <div className="w-full md:w-1/2 flex flex-col">
            <h2 className="text-2xl font-semibold mb-4">Cart Details</h2>
            <div className="flex-1 overflow-auto">
              {/* Table on desktop */}
              <div className="hidden md:block">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 font-medium text-gray-600">Tooth</th>
                      <th className="p-2 font-medium text-gray-600">
                        Customization
                      </th>
                      <th className="p-2 font-medium text-gray-600 text-right">
                        Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-medium text-gray-800">
                          {item.tooth}
                        </td>
                        <td className="p-2 text-gray-700">
                          {item.customization}
                        </td>
                        <td className="p-2 text-right text-gray-800">
                          ${item.cost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* List on mobile */}
              <ul className="md:hidden divide-y divide-gray-200">
                {items.map((item, idx) => (
                  <li
                    key={idx}
                    className="py-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-800">
                        Tooth {item.tooth}
                      </span>
                      <span className="text-gray-700">${item.cost}</span>
                    </div>
                    <div className="mt-1 text-gray-600">
                      {item.customization}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4">
              <button className="w-full py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors">
                Checkout (${totalCost})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
