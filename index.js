/**
 * OOC Detector - SillyTavern插件
 * 检测用户输入是否符合当前角色卡设定，并在不符合时给出OOC警告
 */

// 插件注册
(function() {
    // 插件ID
    const PLUGIN_ID = 'ooc-detector';
    
    // 插件名称
    const PLUGIN_NAME = 'OOC Detector';
    
    // 插件设置
    let settings = {
        enabled: true,
        strictness: 3, // 1-5，检测严格程度
        showWarningPopup: true, // 是否显示警告弹窗
        preventSending: false, // 是否阻止发送OOC消息
        aiAssistance: true, // 是否使用AI辅助判断
        customPrompt: "分析以下用户输入是否符合角色卡设定。如果不符合，请指出具体原因。" // 自定义AI提示
    };
    
    // 缓存当前角色卡信息
    let currentCharacterData = null;
    
    // 初始化插件
    function init() {
        // 添加设置UI
        addSettings();
        
        // 添加事件监听器
        registerEventListeners();
        
        // 初始化UI元素
        createUI();
        
        console.log(`${PLUGIN_NAME} 插件已加载`);
    }
    
    // 添加设置UI
    function addSettings() {
        const settingsHtml = `
            <div class="ooc-detector-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>OOC检测器设置</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="flex-container">
                            <label class="checkbox_label" for="ooc_detector_enabled">
                                <input type="checkbox" id="ooc_detector_enabled" ${settings.enabled ? 'checked' : ''}>
                                <span>启用OOC检测</span>
                            </label>
                        </div>
                        <div class="flex-container">
                            <label for="ooc_detector_strictness">检测严格程度：</label>
                            <input type="range" id="ooc_detector_strictness" min="1" max="5" value="${settings.strictness}">
                            <span id="ooc_detector_strictness_value">${settings.strictness}</span>
                        </div>
                        <div class="flex-container">
                            <label class="checkbox_label" for="ooc_detector_show_warning">
                                <input type="checkbox" id="ooc_detector_show_warning" ${settings.showWarningPopup ? 'checked' : ''}>
                                <span>显示警告弹窗</span>
                            </label>
                        </div>
                        <div class="flex-container">
                            <label class="checkbox_label" for="ooc_detector_prevent_sending">
                                <input type="checkbox" id="ooc_detector_prevent_sending" ${settings.preventSending ? 'checked' : ''}>
                                <span>阻止发送OOC消息</span>
                            </label>
                        </div>
                        <div class="flex-container">
                            <label class="checkbox_label" for="ooc_detector_ai_assistance">
                                <input type="checkbox" id="ooc_detector_ai_assistance" ${settings.aiAssistance ? 'checked' : ''}>
                                <span>使用AI辅助判断</span>
                            </label>
                        </div>
                        <div class="flex-container">
                            <label for="ooc_detector_custom_prompt">自定义AI提示：</label>
                            <textarea id="ooc_detector_custom_prompt" rows="3" style="width: 100%;">${settings.customPrompt}</textarea>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('#extensions_settings').append(settingsHtml);
        
        // 添加设置事件监听器
        $('#ooc_detector_enabled').on('change', function() {
            settings.enabled = !!$(this).prop('checked');
            saveSettings();
        });
        
        $('#ooc_detector_strictness').on('input', function() {
            settings.strictness = Number($(this).val());
            $('#ooc_detector_strictness_value').text(settings.strictness);
            saveSettings();
        });
        
        $('#ooc_detector_show_warning').on('change', function() {
            settings.showWarningPopup = !!$(this).prop('checked');
            saveSettings();
        });
        
        $('#ooc_detector_prevent_sending').on('change', function() {
            settings.preventSending = !!$(this).prop('checked');
            saveSettings();
        });
        
        $('#ooc_detector_ai_assistance').on('change', function() {
            settings.aiAssistance = !!$(this).prop('checked');
            saveSettings();
        });
        
        $('#ooc_detector_custom_prompt').on('change', function() {
            settings.customPrompt = $(this).val();
            saveSettings();
        });
    }
    
    // 注册事件监听器
    function registerEventListeners() {
        // 监听发送消息事件
        eventSource.on('SendMessageButton', async (requestData) => {
            if (!settings.enabled) return;
            
            const userInput = requestData.getMessage();
            
            // 获取当前角色卡数据
            updateCurrentCharacterData();
            
            // 检测OOC
            const oocResult = await detectOOC(userInput);
            
            if (oocResult.isOOC) {
                console.log('检测到OOC:', oocResult.reason);
                
                // 显示警告
                if (settings.showWarningPopup) {
                    showOOCWarning(oocResult.reason);
                }
                
                // 阻止发送
                if (settings.preventSending) {
                    return false;
                }
            }
        });
        
        // 监听角色切换事件
        eventSource.on('characterSelected', () => {
            updateCurrentCharacterData();
        });
    }
    
    // 创建UI元素
    function createUI() {
        // 创建OOC警告弹窗
        const warningHtml = `
            <div id="ooc_warning_popup" class="ooc-warning-popup" style="display: none;">
                <div class="ooc-warning-content">
                    <h3>OOC警告</h3>
                    <p id="ooc_warning_reason"></p>
                    <div class="ooc-warning-buttons">
                        <button id="ooc_warning_edit">编辑消息</button>
                        <button id="ooc_warning_ignore">忽略并发送</button>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(warningHtml);
        
        // 添加警告弹窗事件监听器
        $('#ooc_warning_edit').on('click', function() {
            $('#ooc_warning_popup').hide();
        });
        
        $('#ooc_warning_ignore').on('click', function() {
            $('#ooc_warning_popup').hide();
            // 强制发送消息
            $('#send_but').trigger('click', [true]);
        });
    }
    
    // 更新当前角色卡数据
    function updateCurrentCharacterData() {
        if (!window.characters || !window.characters[window.character_id]) {
            currentCharacterData = null;
            return;
        }
        
        const character = window.characters[window.character_id];
        
        currentCharacterData = {
            name: character.name,
            description: character.description,
            personality: character.personality,
            scenario: character.scenario,
            firstMes: character.first_mes,
            mesExample: character.mes_example,
            // 添加其他可能需要的角色卡信息
        };
    }
    
    // 检测OOC
    async function detectOOC(userInput) {
        if (!currentCharacterData) {
            return { isOOC: false, reason: '无法获取角色卡信息' };
        }
        
        // 基础检测
        const basicResult = basicOOCDetection(userInput);
        if (basicResult.isOOC) {
            return basicResult;
        }
        
        // 如果启用了AI辅助，使用AI进行更深入的检测
        if (settings.aiAssistance) {
            return await aiAssistedOOCDetection(userInput);
        }
        
        return { isOOC: false, reason: '' };
    }
    
    // 基础OOC检测
    function basicOOCDetection(userInput) {
        // 检测用户是否在扮演角色
        if (!currentCharacterData) {
            return { isOOC: false, reason: '无法获取角色卡信息' };
        }
        
        const result = { isOOC: false, reason: '' };
        
        // 检查是否包含角色名称（可能表示用户在扮演角色）
        if (userInput.includes(currentCharacterData.name + ':') || 
            userInput.includes(currentCharacterData.name + '：')) {
            result.isOOC = true;
            result.reason = `你似乎在扮演角色 "${currentCharacterData.name}"，这是OOC行为`;
            return result;
        }
        
        // 检查是否包含明显的OOC标记
        const oocMarkers = ['ooc', '(ooc)', '[ooc]', '{ooc}', '<ooc>', '【ooc】', '（ooc）'];
        for (const marker of oocMarkers) {
            if (userInput.toLowerCase().includes(marker)) {
                result.isOOC = true;
                result.reason = `消息中包含OOC标记 "${marker}"`;
                return result;
            }
        }
        
        // 检查是否包含明显的元对话内容
        const metaPatterns = [
            /^你能/i, /^请你/i, /^我希望你/i, /^我想让你/i, 
            /扮演[^，。！？]*角色/i, /角色扮演/i, /^作为AI/i, /^作为一个AI/i,
            /^你是AI/i, /^你是一个AI/i, /^你是语言模型/i
        ];
        
        for (const pattern of metaPatterns) {
            if (pattern.test(userInput)) {
                result.isOOC = true;
                result.reason = `消息中包含元对话内容，如指示AI或讨论角色扮演`;
                return result;
            }
        }
        
        return result;
    }
    
    // AI辅助OOC检测
    async function aiAssistedOOCDetection(userInput) {
        try {
            // 构建提示
            const prompt = buildOOCDetectionPrompt(userInput);
            
            // 调用API进行分析
            const response = await callOOCDetectionAPI(prompt);
            
            // 解析结果
            return parseOOCDetectionResponse(response);
        } catch (error) {
            console.error('AI辅助OOC检测出错:', error);
            return { isOOC: false, reason: '无法完成AI辅助检测' };
        }
    }
    
    // 构建OOC检测提示
    function buildOOCDetectionPrompt(userInput) {
        let prompt = settings.customPrompt + '\n\n';
        
        // 添加角色卡信息
        prompt += '角色卡信息:\n';
        prompt += `名称: ${currentCharacterData.name}\n`;
        prompt += `描述: ${currentCharacterData.description}\n`;
        prompt += `性格: ${currentCharacterData.personality}\n`;
        prompt += `场景: ${currentCharacterData.scenario}\n`;
        prompt += `第一条消息: ${currentCharacterData.firstMes}\n`;
        prompt += `示例消息: ${currentCharacterData.mesExample}\n\n`;
        
        // 添加用户输入
        prompt += `用户输入: "${userInput}"\n\n`;
        
        // 添加分析指令
        prompt += '请分析用户输入是否符合角色卡设定。如果不符合，请指出具体原因。\n';
        prompt += '回复格式: {"isOOC": true/false, "reason": "具体原因"}\n';
        
        return prompt;
    }
    
    // 调用OOC检测API
    async function callOOCDetectionAPI(prompt) {
        // 这里使用SillyTavern的API发送请求
        // 注意：这里假设SillyTavern提供了一个内部API来发送请求
        // 实际实现可能需要根据SillyTavern的API调整
        
        try {
            // 使用当前活跃的API发送请求
            const response = await fetch('/api/extra/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt,
                    max_tokens: 200,
                    temperature: 0.3,
                }),
            });
            
            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
            const data = await response.json();
            return data.response || data.text || '';
        } catch (error) {
            console.error('调用OOC检测API出错:', error);
            throw error;
        }
    }
    
    // 解析OOC检测响应
    function parseOOCDetectionResponse(response) {
        try {
            // 尝试从响应中提取JSON
            const jsonMatch = response.match(/\{.*\}/s);
            if (jsonMatch) {
                const jsonResponse = JSON.parse(jsonMatch[0]);
                return {
                    isOOC: !!jsonResponse.isOOC,
                    reason: jsonResponse.reason || '未提供原因'
                };
            }
            
            // 如果没有找到JSON，尝试从文本中判断
            const isOOC = response.toLowerCase().includes('ooc') || 
                          response.includes('不符合') || 
                          response.includes('违背');
            
            return {
                isOOC: isOOC,
                reason: isOOC ? response.split('\n')[0] : ''
            };
        } catch (error) {
            console.error('解析OOC检测响应出错:', error);
            return { isOOC: false, reason: '无法解析AI响应' };
        }
    }
    
    // 显示OOC警告
    function showOOCWarning(reason) {
        $('#ooc_warning_reason').text(reason);
        $('#ooc_warning_popup').show();
    }
    
    // 保存设置
    function saveSettings() {
        localStorage.setItem(`${PLUGIN_ID}_settings`, JSON.stringify(settings));
    }
    
    // 加载设置
    function loadSettings() {
        const savedSettings = localStorage.getItem(`${PLUGIN_ID}_settings`);
        if (savedSettings) {
            try {
                settings = {...settings, ...JSON.parse(savedSettings)};
            } catch (error) {
                console.error('加载设置出错:', error);
            }
        }
    }
    
    // 加载设置并初始化插件
    loadSettings();
    init();
    
    // 注册插件
    registerPlugin({
        name: PLUGIN_NAME,
        id: PLUGIN_ID
    });
})(); 
