import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPageShell from '../components/AdminPageShell';
import { useAdminBreadcrumbTail } from '../context/AdminBreadcrumbContext';
import { PLACEHOLDER_IMAGES, resolveMediaUrl } from '../utils/media';
import './AdminDashboard.css';
import './AdminStoreSettingsPage.css';

const UNIT_OPTIONS = ['ชิ้น', 'แพ็ค', 'ขวด', 'กิโลกรัม', 'กรัม', 'มิลลิลิตร', 'ลิตร', 'อื่นๆ'];
const UNIT_DETAIL_OPTIONS = ['มล.', 'ลิตร', 'กรัม', 'กก.', 'ชิ้น', 'แพ็ค', 'ขวด', 'กล่อง', 'ซอง', 'ถุง'];
const getDefaultCreateForm = () => ({
  name: '',
  description: '',
  price: '',
  compare_at_price: '',
  unit_label: 'ชิ้น',
  custom_unit_label: '',
  unit_detail: '',
  unit_detail_value: '',
  unit_detail_unit: 'มล.',
  image: '',
  category: '',
  stock_quantity: '',
  is_available: true,
  is_featured: false,
});

const AdminProductFormPage = () => {
  const popup = usePopup();
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = Boolean(productId);
  const productsListPath = useMemo(
    () => `/admin/products${location.state?.adminProductsReturnSearch || ''}`,
    [location.state?.adminProductsReturnSearch],
  );
  const getAdminToken = () => localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState('back');
  const [categories, setCategories] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [form, setForm] = useState(getDefaultCreateForm);

  const pageTitle = useMemo(() => (isEditMode ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'), [isEditMode]);

  const editProductBreadcrumbName = useMemo(() => {
    if (!isEditMode) return null;
    const n = (form.name || '').trim();
    return n || null;
  }, [isEditMode, form.name]);

  useAdminBreadcrumbTail(editProductBreadcrumbName);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = getAdminToken();
        const categoryRes = await fetch(`${config.API_BASE_URL}products/admin/categories/`, {
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (!categoryRes.ok) throw new Error('โหลดหมวดหมู่ไม่สำเร็จ');
        const categoryData = await categoryRes.json();
        const categoryList = categoryData.results || categoryData || [];
        setCategories(Array.isArray(categoryList) ? categoryList : []);

        if (isEditMode) {
          const productRes = await fetch(`${config.API_BASE_URL}products/admin/${productId}/`, {
            headers: {
              Authorization: `Token ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
            credentials: 'include',
          });
          if (!productRes.ok) throw new Error('โหลดข้อมูลสินค้าไม่สำเร็จ');
          const product = await productRes.json();

          const normalizedUnit = UNIT_OPTIONS.includes(product.unit_label) ? product.unit_label : 'อื่นๆ';
          setForm({
            name: product.name || '',
            description: product.description || '',
            price: String(product.price ?? ''),
            compare_at_price:
              product.compare_at_price != null && product.compare_at_price !== ''
                ? String(product.compare_at_price)
                : '',
            unit_label: normalizedUnit || 'ชิ้น',
            custom_unit_label: normalizedUnit === 'อื่นๆ' ? (product.unit_label || '') : '',
            unit_detail: product.unit_detail || '',
            unit_detail_value: '',
            unit_detail_unit: 'มล.',
            image: product.image || '',
            category: String(product.category ?? ''),
            stock_quantity: String(product.stock_quantity ?? 0),
            is_available: Boolean(product.is_available),
            is_featured: Boolean(product.is_featured),
          });
        }
      } catch (error) {
        popup.error(error.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isEditMode, productId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const clearProductImage = async () => {
    if (!isEditMode) return;
    if (!(await popup.confirm('ยืนยันลบรูปสินค้านี้?', { tone: 'danger', confirmText: 'ลบรูป' }))) return;
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}products/admin/${productId}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ image: null }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'ลบรูปสินค้าไม่สำเร็จ');
      }
      setForm((prev) => ({ ...prev, image: '' }));
      setImageFile(null);
      popup.info('ลบรูปสินค้าเรียบร้อย');
    } catch (error) {
      popup.error(error.message || 'ลบรูปสินค้าไม่สำเร็จ');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = getAdminToken();
      const resolvedUnitLabel = form.unit_label === 'อื่นๆ' ? form.custom_unit_label.trim() : form.unit_label.trim();
      if (!resolvedUnitLabel) {
        throw new Error('กรุณาระบุหน่วยสินค้า');
      }

      const generatedUnitDetail = form.unit_detail_value
        ? `${form.unit_detail_value} ${form.unit_detail_unit}`.trim()
        : '';
      const mergedUnitDetail = generatedUnitDetail
        ? `${generatedUnitDetail}${form.unit_detail.trim() ? ` (${form.unit_detail.trim()})` : ''}`
        : form.unit_detail.trim();

      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('description', form.description.trim());
      formData.append('price', String(parseFloat(form.price)));
      const cmpRaw = form.compare_at_price.trim();
      formData.append('compare_at_price', cmpRaw === '' ? '' : String(parseFloat(cmpRaw)));
      formData.append('unit_label', resolvedUnitLabel);
      formData.append('unit_detail', mergedUnitDetail);
      formData.append('category', String(parseInt(form.category, 10)));
      formData.append('stock_quantity', String(parseInt(form.stock_quantity, 10)));
      formData.append('is_available', form.is_available ? 'true' : 'false');
      formData.append('is_featured', form.is_featured ? 'true' : 'false');
      formData.append('is_special_offer', 'false');
      if (imageFile) formData.append('image', imageFile);

      const url = isEditMode
        ? `${config.API_BASE_URL}products/admin/${productId}/`
        : `${config.API_BASE_URL}products/admin/`;
      const method = isEditMode ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'บันทึกสินค้าไม่สำเร็จ');
      }
      if (!isEditMode && pendingSaveAction === 'continue') {
        popup.info('เพิ่มสินค้าเรียบร้อย พร้อมเพิ่มรายการถัดไป');
        setForm((prev) => ({
          ...getDefaultCreateForm(),
          category: prev.category,
          unit_label: prev.unit_label,
          custom_unit_label: prev.custom_unit_label,
          unit_detail_unit: prev.unit_detail_unit,
          is_available: prev.is_available,
          is_featured: prev.is_featured,
        }));
        setImageFile(null);
      } else {
        popup.info(isEditMode ? 'บันทึกการแก้ไขสินค้าเรียบร้อย' : 'เพิ่มสินค้าใหม่เรียบร้อย');
        navigate(productsListPath);
      }
    } catch (error) {
      popup.error(error.message || 'บันทึกสินค้าไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminPageShell
        header={<AdminPageHeader title={pageTitle} />}
      >
        <div className="loading">กำลังโหลดข้อมูลสินค้า...</div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      header={<AdminPageHeader title={pageTitle} />}
    >
        <section className="store-settings-card">
        <form className="product-form product-form--embedded" onSubmit={handleSubmit}>
          {isEditMode && form.image && (
            <div style={{ marginBottom: '10px' }}>
              <img
                src={resolveMediaUrl(form.image, PLACEHOLDER_IMAGES.md)}
                alt={form.name || 'product-image'}
                style={{ width: '120px', borderRadius: '8px', border: '1px solid #d9deea' }}
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER_IMAGES.md;
                }}
              />
              <div style={{ marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={clearProductImage}>
                  ลบรูปสินค้า
                </button>
              </div>
            </div>
          )}

          <div className="product-form-grid">
            <input name="name" value={form.name} onChange={handleInputChange} placeholder="ชื่อสินค้า" required />
            <input name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleInputChange} placeholder="ราคาขายจริง (หลังลด)" required />
            <input
              name="compare_at_price"
              type="number"
              min="0"
              step="0.01"
              value={form.compare_at_price}
              onChange={handleInputChange}
              placeholder="ราคาก่อนลด — ต้องสูงกว่าราคาขาย"
            />
            <select name="unit_label" value={form.unit_label} onChange={handleInputChange} required>
              {UNIT_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            {form.unit_label === 'อื่นๆ' && (
              <input name="custom_unit_label" value={form.custom_unit_label} onChange={handleInputChange} placeholder="ระบุหน่วยสินค้าเอง" required />
            )}
            <input name="unit_detail_value" type="number" min="0" step="0.01" value={form.unit_detail_value} onChange={handleInputChange} placeholder="ขนาด/ปริมาณ (เช่น 500)" />
            <select name="unit_detail_unit" value={form.unit_detail_unit} onChange={handleInputChange}>
              {UNIT_DETAIL_OPTIONS.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
            <input name="unit_detail" value={form.unit_detail} onChange={handleInputChange} placeholder="หมายเหตุหน่วยเพิ่มเติม (ถ้ามี)" />
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            <input name="stock_quantity" type="number" min="0" value={form.stock_quantity} onChange={handleInputChange} placeholder="จำนวนสต็อก" required />
            <select name="category" value={form.category} onChange={handleInputChange} required>
              <option value="">เลือกหมวดหมู่</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <p className="product-form-price-hint" style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45 }}>
            <strong>ราคา:</strong> ช่องแรก = ราคาที่ลูกค้าจ่ายจริง · ช่องราคาก่อนลด = ราคาป้ายเดิม (ถ้ากรอกและสูงกว่าราคาขาย ระบบจะแสดงว่าลดแล้ว — ไม่ต้องติ๊กอื่น)
          </p>

          <textarea
            name="description"
            value={form.description}
            onChange={handleInputChange}
            placeholder="คำอธิบายสินค้า"
            rows="2"
          />

          <div className="product-form-options">
            <label>
              <input type="checkbox" name="is_available" checked={form.is_available} onChange={handleInputChange} />
              พร้อมขาย
            </label>
            <label>
              <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleInputChange} />
              สินค้าแนะนำบนหน้าแรก — <strong>ต้องติ๊ก</strong>ถึงจะขึ้นมุมแนะนำ (ไม่เกี่ยวกับการลดราคา)
            </label>
          </div>

          <div className="personnel-form-actions">
            {isEditMode ? (
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไขสินค้า'}
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => setPendingSaveAction('back')}
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกและปิด'}
                </button>
                <button
                  type="submit"
                  className="btn-secondary"
                  disabled={saving}
                  onClick={() => setPendingSaveAction('continue')}
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกและเพิ่มรายการต่อ'}
                </button>
              </>
            )}
          </div>
        </form>
        </section>
    </AdminPageShell>
  );
};

export default AdminProductFormPage;
